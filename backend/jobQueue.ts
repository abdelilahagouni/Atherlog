type JobFn<T> = () => Promise<T>;

type JobOptions = {
    maxAttempts?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
};

type InternalJob<T> = {
    id: string;
    fn: JobFn<T>;
    attempts: number;
    maxAttempts: number;
    delayMs: number;
    backoffFactor: number;
};

export class JobQueue {
    private readonly name: string;
    private readonly concurrency: number;
    private running = 0;
    private queue: InternalJob<any>[] = [];

    constructor(name: string, concurrency: number) {
        this.name = name;
        this.concurrency = Math.max(1, concurrency);
    }

    enqueue<T>(id: string, fn: JobFn<T>, options: JobOptions = {}) {
        const job: InternalJob<T> = {
            id,
            fn,
            attempts: 0,
            maxAttempts: Math.max(1, options.maxAttempts ?? 3),
            delayMs: Math.max(0, options.initialDelayMs ?? 0),
            backoffFactor: Math.max(1, options.backoffFactor ?? 2),
        };
        this.queue.push(job);
        this.pump();
    }

    size() {
        return this.queue.length;
    }

    private pump() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const job = this.queue.shift()!;
            this.running++;
            void this.runJob(job).finally(() => {
                this.running--;
                this.pump();
            });
        }
    }

    private async runJob<T>(job: InternalJob<T>) {
        if (job.delayMs > 0) {
            await new Promise((r) => setTimeout(r, job.delayMs));
        }

        try {
            await job.fn();
        } catch (e: any) {
            job.attempts++;
            if (job.attempts >= job.maxAttempts) {
                console.error(`[${this.name}] job failed permanently: ${job.id}`, e?.message || e);
                return;
            }

            const nextDelay = job.delayMs > 0 ? Math.floor(job.delayMs * job.backoffFactor) : 250;
            job.delayMs = Math.min(nextDelay, 30_000);
            console.warn(`[${this.name}] job failed, retrying: ${job.id} attempt ${job.attempts + 1}/${job.maxAttempts}`);
            this.queue.push(job);
        }
    }
}

export const alertQueue = new JobQueue('alert-queue', parseInt(process.env.ALERT_QUEUE_CONCURRENCY || '2', 10));
