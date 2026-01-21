import { LearnedInsight, InsightType, LogEntry, LogPattern, AiPlaybook } from "../types";

const INSIGHTS_KEY = 'saas_app_learned_insights';

const initializeInsights = () => {
    if (!localStorage.getItem(INSIGHTS_KEY)) {
        localStorage.setItem(INSIGHTS_KEY, JSON.stringify([]));
    }
}
initializeInsights();

export const getLearnedInsights = (): Promise<LearnedInsight[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const insights = JSON.parse(localStorage.getItem(INSIGHTS_KEY) || '[]');
            resolve(insights.sort((a: LearnedInsight, b: LearnedInsight) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        }, 300); // Simulate network delay
    });
};

export const saveInsight = (insightData: {
    type: InsightType;
    title: string;
    summary: string;
    originalQuery?: string;
    originalLog?: LogEntry;
    pattern?: LogPattern;
    playbook?: AiPlaybook;
}): Promise<LearnedInsight> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const insights: LearnedInsight[] = JSON.parse(localStorage.getItem(INSIGHTS_KEY) || '[]');
                
                const newInsight: LearnedInsight = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    ...insightData,
                };

                const updatedInsights = [newInsight, ...insights];
                localStorage.setItem(INSIGHTS_KEY, JSON.stringify(updatedInsights));
                resolve(newInsight);

            } catch (error) {
                console.error("Failed to save insight:", error);
                reject(new Error("Could not save insight to local storage."));
            }
        }, 300);
    });
};

export const updateInsightNotes = (insightId: string, notes: string): Promise<LearnedInsight> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const insights: LearnedInsight[] = JSON.parse(localStorage.getItem(INSIGHTS_KEY) || '[]');
                const insightIndex = insights.findIndex(i => i.id === insightId);

                if (insightIndex === -1) {
                    return reject(new Error("Insight not found."));
                }
                
                insights[insightIndex].userNotes = notes;
                localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
                resolve(insights[insightIndex]);

            } catch (error) {
                console.error("Failed to update insight notes:", error);
                reject(new Error("Could not update insight notes in local storage."));
            }
        }, 300);
    });
};

export const deleteInsight = (insightId: string): Promise<void> => {
     return new Promise((resolve, reject) => {
        setTimeout(() => {
             try {
                let insights: LearnedInsight[] = JSON.parse(localStorage.getItem(INSIGHTS_KEY) || '[]');
                insights = insights.filter(i => i.id !== insightId);
                localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
                resolve();
            } catch (error) {
                console.error("Failed to delete insight:", error);
                reject(new Error("Could not delete insight from local storage."));
            }
        }, 300);
    });
}