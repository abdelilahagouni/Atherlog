import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { Card } from './ui/Card';
import { developerAvatar } from '../assets/images';

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 text-left">
        <Icon name={icon} className="w-10 h-10 text-[var(--accent-color-gold)] mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);


const AboutPage: React.FC = () => {
    
    const features = [
        { icon: 'sparkles', title: 'AI-Powered Analysis', description: 'Automatically detect anomalies, get plain-English explanations for errors, and perform root cause analysis.' },
        { icon: 'search', title: 'Advanced Log Explorer', description: 'Search and filter billions of log lines with a powerful query language and real-time histogram.' },
        { icon: 'visual-parser', title: 'Visual Parser', description: 'Extract text from terminal screenshots and even generate flowcharts from code snippets.' },
        { icon: 'bell', title: 'Intelligent Alerting', description: 'Configure multi-channel alerts for critical events based on severity, anomaly score, and custom rules.' },
        { icon: 'sitemap', title: 'Data Ingestion API', description: 'Send logs from any application using our simple and secure API ingestion endpoints.' },
        { icon: 'users-group', title: 'Team Collaboration', description: 'Manage your organization, control access with roles, and share insights with your team.' },
    ];

    return (
        <div className="min-h-screen text-white">
             <header className="absolute top-0 left-0 right-0 z-10 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-md animate-heartbeat"><Icon name="logo" className="w-6 h-6" /></div>
                        <span className="font-bold text-xl animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></span>
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        <Link to="/pricing" className="hover:text-[var(--accent-color-gold)] transition-colors">Pricing</Link>
                        <Link to="/login" className="hover:text-[var(--accent-color-gold)] transition-colors">Login</Link>
                        <Link to="/signup" className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">Get Started</Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative flex flex-col items-center justify-center min-h-[60vh] text-center p-4 pt-20">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-900/50 to-[#1C1C1E] animated-gradient opacity-80"></div>
                <div className="relative z-5">
                    <h1 className="text-5xl md:text-7xl font-bold mb-4 animate-slide-up-fade-in">About AetherLog</h1>
                    <p className="text-lg text-gray-300 max-w-3xl mx-auto animate-slide-up-fade-in" style={{ animationDelay: '200ms' }}>
                        Transforming the chaos of log data into clarity and actionable insight. We are dedicated to empowering developers and operations teams to build more resilient systems.
                    </p>
                </div>
            </section>
            
            <section className="py-20 bg-black/20">
                <div className="container mx-auto px-4 text-center">
                     <h2 className="text-4xl font-bold text-white mb-12">Our Mission: Insight, Not Information</h2>
                     <p className="text-gray-400 max-w-3xl mx-auto text-lg">
                        In today's complex digital ecosystems, developers are drowning in a sea of log data. AetherLog was built on a simple premise: to turn that overwhelming noise into a clear, intelligent signal. We leverage the power of Artificial Intelligence not just to show you what's happening, but to tell you why it's happening and what you can do about it. Our goal is to reduce debugging time, predict failures before they happen, and give teams the confidence to innovate faster.
                     </p>
                </div>
            </section>
            
             <section className="py-20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-white mb-12">Core Features</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <FeatureCard key={index} {...feature} />
                        ))}
                    </div>
                </div>
            </section>
            
            <section className="py-20 bg-black/20">
                <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-12">
                    <img src={developerAvatar} alt="Developer Abdelilah Agouni" className="w-48 h-48 rounded-full border-4 border-gray-600 shadow-lg"/>
                    <div className="text-center md:text-left max-w-xl">
                        <h2 className="text-3xl font-bold text-white mb-2">Meet the Developer</h2>
                         <p className="text-gray-400">
                        This application was proudly developed by <strong>Abdelilah Agouni</strong>, a passionate student developer with a love for creating robust, user-friendly full-stack applications. This project showcases skills in modern web technologies, AI integration, and UX design.
                    </p>
                     <div className="flex justify-center md:justify-start gap-6 mt-6">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-blue-400 transition-colors">
                            <Icon name="github" className="w-6 h-6"/>
                            <span>GitHub</span>
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-blue-400 transition-colors">
                            <Icon name="linkedin" className="w-6 h-6"/>
                            <span>LinkedIn</span>
                        </a>
                    </div>
                    </div>
                </div>
            </section>

             <section className="py-20 text-center">
                 <div className="container mx-auto px-4">
                    <h2 className="text-4xl font-bold text-white mb-4">Ready to Tame Your Logs?</h2>
                    <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Sign up for a free account and start turning your log data into actionable insight today.</p>
                    <Link to="/signup" className="bg-white text-gray-900 font-semibold px-8 py-4 rounded-lg hover:bg-gray-200 transition-transform hover:scale-105 text-lg">
                        Get Started for Free
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default AboutPage;