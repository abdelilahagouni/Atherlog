export interface SoundConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  fatalError: boolean;
  criticalError: boolean;
  warningError: boolean;
}

export interface AlertSound {
  type: 'fatal' | 'critical' | 'warning';
  soundFile: string;
  description: string;
}

class SoundNotificationService {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private config: SoundConfig = {
    enabled: true,
    volume: 0.7,
    fatalError: true,
    criticalError: true,
    warningError: false
  };

  constructor() {
    this.initializeAudioContext();
    this.loadConfig();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  private loadConfig(): void {
    const savedConfig = localStorage.getItem('soundNotificationConfig');
    if (savedConfig) {
      this.config = { ...this.config, ...JSON.parse(savedConfig) };
    }
  }

  saveConfig(): void {
    localStorage.setItem('soundNotificationConfig', JSON.stringify(this.config));
  }

  getConfig(): SoundConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<SoundConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  // Generate WhatsApp-like sounds programmatically
  private async generateWhatsAppSounds(): Promise<void> {
    if (!this.audioContext) return;

    // Fatal error sound - similar to WhatsApp urgent notification
    await this.generateFatalErrorSound();
    
    // Critical error sound - similar to WhatsApp regular notification
    await this.generateCriticalErrorSound();
    
    // Warning sound - softer notification sound
    await this.generateWarningSound();
    
    // Welcome sound - pleasant chime for dashboard entry
    await this.generateWelcomeSound();
  }

  private async generateFatalErrorSound(): Promise<void> {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.8; // 800ms
    const numSamples = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(2, numSamples, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Create a two-tone beep like WhatsApp's urgent sound
        const freq1 = 800; // First frequency
        const freq2 = 1200; // Second frequency
        const envelope = Math.exp(-t * 3); // Quick decay
        
        // Alternate between frequencies
        const freq = (i % (sampleRate * 0.1)) < (sampleRate * 0.05) ? freq1 : freq2;
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
      }
    }

    this.sounds.set('fatal', buffer);
  }

  private async generateCriticalErrorSound(): Promise<void> {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4; // 400ms
    const numSamples = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(2, numSamples, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // WhatsApp-like single tone notification
        const freq = 1000; // 1kHz tone
        const envelope = Math.exp(-t * 5); // Quick decay
        
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.25;
      }
    }

    this.sounds.set('critical', buffer);
  }

  private async generateWarningSound(): Promise<void> {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3; // 300ms
    const numSamples = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(2, numSamples, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Softer warning sound
        const freq = 600; // Lower frequency
        const envelope = Math.exp(-t * 4); // Quick decay
        
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.15;
      }
    }

    this.sounds.set('warning', buffer);
  }

  private async generateWelcomeSound(): Promise<void> {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.5; // 500ms
    const numSamples = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(2, numSamples, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Pleasant ascending two-tone chime (like WhatsApp message received)
        const freq1 = 523.25; // C5
        const freq2 = 659.25; // E5
        const envelope = Math.exp(-t * 4) * Math.sin(Math.PI * t / duration);
        
        // First note then second note
        const freq = t < 0.2 ? freq1 : freq2;
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.2;
      }
    }

    this.sounds.set('welcome', buffer);
  }

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }
    
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    await this.generateWhatsAppSounds();
  }

  async playSound(type: 'fatal' | 'critical' | 'warning' | 'welcome'): Promise<void> {
    if (!this.config.enabled || !this.audioContext) return;

    // Check if this sound type is enabled (welcome always plays)
    if (type === 'fatal' && !this.config.fatalError) return;
    if (type === 'critical' && !this.config.criticalError) return;
    if (type === 'warning' && !this.config.warningError) return;

    const sound = this.sounds.get(type);
    if (!sound) return;

    // Resume audio context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = sound;
    gainNode.gain.value = this.config.volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  // Test method to preview sounds
  async testSound(type: 'fatal' | 'critical' | 'warning' | 'welcome'): Promise<void> {
    await this.playSound(type);
  }

  // Get available sounds for UI
  getAvailableSounds(): AlertSound[] {
    return [
      {
        type: 'fatal',
        soundFile: 'Generated WhatsApp-like urgent tone',
        description: 'Fatal error - Two-tone urgent notification'
      },
      {
        type: 'critical',
        soundFile: 'Generated WhatsApp-like regular tone',
        description: 'Critical error - Single tone notification'
      },
      {
        type: 'warning',
        soundFile: 'Generated soft warning tone',
        description: 'Warning - Soft notification tone'
      }
    ];
  }
}

export const soundNotificationService = new SoundNotificationService();