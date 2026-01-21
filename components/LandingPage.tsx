import * as React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui/Icon';
import { developerAvatar } from '../assets/images';

const LandingPage: React.FC = () => {
    const { currentUser, isAuthLoading } = useAuth();

    const features = [
        { icon: 'sparkles', title: 'AI-Powered Analysis', description: 'Automatically detect anomalies, get plain-English explanations for errors, and perform root cause analysis.' },
        { icon: 'search', title: 'Advanced Log Explorer', description: 'Search and filter billions of log lines with a powerful query language and real-time histogram.' },
        { icon: 'visual-parser', title: 'Visual Parser', description: 'Extract text from terminal screenshots and even generate flowcharts from code snippets.' },
        { icon: 'bell', title: 'Intelligent Alerting', description: 'Configure multi-channel alerts for critical events based on severity, anomaly score, and custom rules.' },
        { icon: 'sitemap', title: 'Data Ingestion API', description: 'Send logs from any application using our simple and secure API ingestion endpoints.' },
        { icon: 'users-group', title: 'Team Collaboration', description: 'Manage your organization, control access with roles, and share insights with your team.' },
    ];

    if (isAuthLoading) {
        return <div className="flex items-center justify-center h-screen"><Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" /></div>;
    }

    if (currentUser) {
        return <Navigate to="/dashboard" replace />;
    }

    const scrollToFeatures = () => {
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    };

    const heroText = "Turn Log Data into Actionable Insight.";
    const heroWords = heroText.split(' ');

    return (
        <div className="min-h-screen text-white">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-md animate-heartbeat"><Icon name="logo" className="w-6 h-6" /></div>
                        <span className="font-bold text-xl animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        <button onClick={scrollToFeatures} className="hover:text-[var(--accent-color-gold)] transition-colors">Features</button>
                        <Link to="/about" className="hover:text-[var(--accent-color-gold)] transition-colors">About</Link>
                        <Link to="/pricing" className="hover:text-[var(--accent-color-gold)] transition-colors">Pricing</Link>
                        <Link to="/login" className="hover:text-[var(--accent-color-gold)] transition-colors">Login</Link>
                        <Link to="/signup" className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">Get Started</Link>
                    </nav>
                     <div className="md:hidden">
                        <Link to="/login" className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">Login</Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative flex flex-col items-center justify-center min-h-screen text-center p-4 pt-20">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 opacity-80 animated-gradient"></div>
                <div className="relative z-5">
                    <h1 className="text-5xl md:text-7xl font-bold mb-4">
                       {heroWords.map((word, index) => {
                            const wordDelay = 100 + (index * 100);
                            const hasPeriod = word.endsWith('.');
                            const cleanWord = hasPeriod ? word.slice(0, -1) : word;
                            
                            return (
                                <React.Fragment key={index}>
                                    <span className="inline-block animate-slide-up-fade-in" style={{ animationDelay: `${wordDelay}ms` }}>
                                        {cleanWord.split('').map((char, charIndex) => 
                                            char.toLowerCase() === 'i' 
                                            ? <span key={charIndex} className="inline-block animate-heartbeat">{char}</span>
                                            : <span key={charIndex}>{char}</span>
                                        )}
                                        {hasPeriod && <span className="inline-block animate-heartbeat">.</span>}
                                    </span>
                                    {' '}
                                    {word === 'into' && <br className="hidden md:block" />}
                                </React.Fragment>
                            )
                        })}
                    </h1>
                    <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8 animate-slide-up-fade-in" style={{ animationDelay: '800ms' }}>
                        AetherLog analyzes your logs in real-time to detect anomalies, explain errors, and keep your systems running smoothly.
                    </p>
                    <div className="flex justify-center gap-4 animate-slide-up-fade-in" style={{ animationDelay: '900ms' }}>
                        <Link to="/signup" className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 transition-transform hover:scale-105">Get Started for Free</Link>
                        <button onClick={scrollToFeatures} className="bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-transform hover:scale-105">Learn More</button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gray-100 dark:bg-black/20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Why AetherLog?</h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12">Stop drowning in data. Start finding answers.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                        {features.map((feature, index) => (
                            <div key={index} className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg hover:shadow-xl transition-shadow">
                                <Icon name={feature.icon} className="w-10 h-10 text-blue-500 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            
             {/* How It Works */}
            <section className="py-20 bg-gray-200 dark:bg-[#1C1C1E]">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12">Simple to Get Started</h2>
                    <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-4">
                        <div className="flex-1 max-w-xs flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">1</div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ingest Data</h3>
                            <p className="text-gray-600 dark:text-gray-400">Use our secure API to send logs from any source in minutes.</p>
                        </div>
                         <div className="w-0.5 h-16 bg-gray-300 dark:bg-gray-700 md:block hidden"></div>
                        <div className="flex-1 max-w-xs flex flex-col items-center">
                           <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">2</div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Analyze with AI</h3>
                            <p className="text-gray-600 dark:text-gray-400">Our platform automatically detects anomalies and patterns.</p>
                        </div>
                        <div className="w-0.5 h-16 bg-gray-300 dark:bg-gray-700 md:block hidden"></div>
                        <div className="flex-1 max-w-xs flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">3</div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Gain Insight</h3>
                            <p className="text-gray-600 dark:text-gray-400">Use the dashboard and explorer to fix issues faster than ever.</p>
                        </div>
                    </div>
                </div>
            </section>

             <section className="py-20 bg-white dark:bg-black/20">
                <div className="container mx-auto px-4 text-center">
                    <img src={developerAvatar} alt="Developer Abdelilah Agouni" className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-gray-300 dark:border-gray-600 shadow-lg"/>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">About the Developer</h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-6">
                        This application was proudly developed by <strong>Abdelilah Agouni</strong>, a passionate student developer with a love for creating robust, user-friendly full-stack applications. This project showcases skills in modern web technologies, AI integration, and UX design.
                    </p>
                    <div className="flex justify-center gap-6">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                            <Icon name="github" className="w-6 h-6"/>
                            <span>GitHub</span>
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                            <Icon name="linkedin" className="w-6 h-6"/>
                            <span>LinkedIn</span>
                        </a>
                    </div>
                </div>
            </section>
            
            {/* Final CTA */}
            <section className="py-20 text-center relative">
                 <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 opacity-80 animated-gradient"></div>
                 <div className="relative z-5 container mx-auto px-4">
                    <h2 className="text-4xl font-bold text-white mb-4">Ready to Tame Your Logs?</h2>
                    <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Sign up for a free account and start turning your log data into actionable insight today.</p>
                    <Link to="/signup" className="bg-white text-gray-900 font-semibold px-8 py-4 rounded-lg hover:bg-gray-200 transition-transform hover:scale-105 text-lg">
                        Get Started for Free
                    </Link>
                </div>
            </section>
            
            {/* Footer */}
            <footer className="py-12 bg-black/50 text-gray-400 text-sm">
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                    <div>
                        <h4 className="font-semibold text-white mb-2">AetherLog</h4>
                        <p>&copy; {new Date().getFullYear()} AetherLog. All Rights Reserved.</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-white mb-2">Contact Us</h4>
                        <p>For inquiries, support, or feedback, please reach out.</p>
                        <a href="mailto:abdo.agouni@gmail.com" className="text-blue-400 hover:underline">abdo.agouni@gmail.com</a>
                    </div>
                    <div>
                        <h4 className="font-semibold text-white mb-2">Developer</h4>
                        <p>Proudly developed by Abdelilah Agouni.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;