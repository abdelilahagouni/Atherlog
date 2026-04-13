import * as React from 'react';
import { useState, useEffect } from 'react';
import { Responsive, useContainerWidth, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import LiveTail from './LiveTail';
import VisualAnalytics from './VisualAnalytics';
import LiveAnomalies from './LiveAnomalies';



const WIDGETS = [
    { id: 'live-tail', title: 'Live Tail', component: <LiveTail maxLogs={100} /> },
    { id: 'visual-analytics', title: 'Visual Analytics', component: <VisualAnalytics /> },
    { id: 'live-anomalies', title: 'Live Anomalies', component: <LiveAnomalies /> }
];

const DEFAULT_LAYOUTS = {
    lg: [
        { i: 'live-anomalies', x: 0, y: 0, w: 12, h: 4 },
        { i: 'visual-analytics', x: 0, y: 4, w: 6, h: 6 },
        { i: 'live-tail', x: 6, y: 4, w: 6, h: 6 }
    ]
};

const CustomDashboard: React.FC = () => {
    const [layouts, setLayouts] = useState<any>(DEFAULT_LAYOUTS);
    const { width, containerRef, mounted } = useContainerWidth();
    const [isEditing, setIsEditing] = useState(false);
    const [activeWidgets, setActiveWidgets] = useState<string[]>(['live-anomalies', 'visual-analytics', 'live-tail']);

    useEffect(() => {
        // Load layout from localStorage or backend
        const savedLayouts = localStorage.getItem('custom-dashboard-layouts');
        if (savedLayouts) {
            setLayouts(JSON.parse(savedLayouts));
        }
    }, []);

    const onLayoutChange = (layout: Layout, allLayouts: any) => {
        setLayouts(allLayouts);
        localStorage.setItem('custom-dashboard-layouts', JSON.stringify(allLayouts));
    };

    const toggleWidget = (widgetId: string) => {
        if (activeWidgets.includes(widgetId)) {
            setActiveWidgets(activeWidgets.filter(id => id !== widgetId));
        } else {
            setActiveWidgets([...activeWidgets, widgetId]);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="dashboard" className="w-8 h-8 text-blue-500" />
                        Custom Dashboard
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Build your own custom observability views by dragging and resizing widgets.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            isEditing ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                    >
                        <Icon name={isEditing ? 'check' : 'edit'} className="w-4 h-4" />
                        {isEditing ? 'Save Layout' : 'Edit Layout'}
                    </button>
                </div>
            </div>

            {isEditing && (
                <Card className="p-4 mb-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-3">Available Widgets</h3>
                    <div className="flex flex-wrap gap-2">
                        {WIDGETS.map(widget => (
                            <button
                                key={widget.id}
                                onClick={() => toggleWidget(widget.id)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    activeWidgets.includes(widget.id) 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                {activeWidgets.includes(widget.id) ? '✓ ' : '+ '}{widget.title}
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            <div className="min-h-[500px]" ref={containerRef}>
                {mounted && (
                <Responsive
                    width={width}
                    className="layout -mx-2"
                    layouts={layouts}
                    onLayoutChange={onLayoutChange}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={100}
                    dragConfig={{ enabled: isEditing }}
                    resizeConfig={{ enabled: isEditing }}
                    margin={[16, 16]}
                >
                    {WIDGETS.filter(w => activeWidgets.includes(w.id)).map(widget => (
                        <div key={widget.id} className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
                            {isEditing && (
                                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-move handle">
                                    <span className="text-sm font-semibold">{widget.title}</span>
                                    <button onClick={() => toggleWidget(widget.id)} className="text-gray-500 hover:text-red-500">
                                        <Icon name="x-circle" className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="flex-1 overflow-auto relative p-2 pointer-events-auto">
                                {/* Only apply overlay when editing so we don't accidentally interact with inner components while dragging */}
                                {isEditing && <div className="absolute inset-0 z-10" />}
                                {widget.component}
                            </div>
                        </div>
                    ))}
                </Responsive>
                )}
            </div>
        </div>
    );
};

export default CustomDashboard;
