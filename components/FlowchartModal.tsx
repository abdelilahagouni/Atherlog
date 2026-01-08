import * as React from 'react';
import { Icon } from './ui/Icon';
import { generateFlowchartFromText } from '../services/geminiService';
import { useToast } from '../hooks/useToast';
import { FlowchartNode, FlowchartLink, FlowchartResponse } from '../types';

type AiProvider = 'gemini' | 'openai';

interface FlowchartModalProps {
  logText: string;
  provider: AiProvider;
  onClose: () => void;
}

type NodeWithPosition = FlowchartNode & { x: number; y: number; width: number; height: number };
type LinkWithPosition = {
    source: NodeWithPosition;
    target: NodeWithPosition;
    label?: string;
}

const FlowchartNodeComponent: React.FC<{ node: NodeWithPosition, highlightedNodes: Set<string> }> = ({ node, highlightedNodes }) => {
    const isRhombus = node.type === 'rhombus';
    const isOval = node.type === 'oval';
    const isParallelogram = node.type === 'parallelogram';
    const isDocument = node.type === 'document';

    const isStart = isOval && node.text.toLowerCase() === 'start';
    const isEnd = isOval && node.text.toLowerCase() === 'end';

    let shapeClasses = 'rounded-xl'; // Default for rect
    let textContainerClasses = '';

    if (isRhombus) {
        shapeClasses = "transform rotate-45";
        textContainerClasses = "-rotate-45";
    } else if (isOval) {
        shapeClasses = "rounded-full";
    } else if (isParallelogram) {
        shapeClasses = "transform -skew-x-12";
        textContainerClasses = "skew-x-12";
    } else if (isDocument) {
        shapeClasses = "relative pb-4";
    }

    let accentClasses = 'bg-white dark:bg-[#2C2C2E] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100';
    if (isStart) accentClasses = "border-green-500 bg-green-500/10 text-green-800 dark:text-green-300";
    else if (isEnd) accentClasses = "border-red-500 bg-red-500/10 text-red-800 dark:text-red-300";
    
    const isHighlighted = highlightedNodes.has(node.id);
    const hasHighlights = highlightedNodes.size > 0;

    const commonClasses = `border p-2 flex items-center justify-center text-center text-sm font-semibold shadow-lg transition-all duration-300 animate-slide-up-fade-in absolute`;

    return (
        <div 
            id={`node-${node.id}`} 
            className={`${commonClasses} ${shapeClasses} ${accentClasses}`}
            style={{ 
                left: node.x, 
                top: node.y, 
                width: node.width, 
                height: node.height,
                animationDelay: `${Math.random() * 200}ms`,
                opacity: hasHighlights ? (isHighlighted ? 1 : 0.2) : 1,
                transform: `scale(${isHighlighted ? 1.05 : 1})`,
                zIndex: isHighlighted ? 10 : 1,
            }}
        >
            <span className={textContainerClasses}>{node.text}</span>
            {isDocument && (
                <svg className="absolute bottom-0 left-0 w-full h-4" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M 0 5 C 25 10, 25 0, 50 5 S 75 10, 100 5" stroke="currentColor" fill="none" strokeWidth="1.5" opacity="0.3"/>
                </svg>
            )}
        </div>
    );
};

// Simple layout algorithm
const layoutFlowchart = (data: FlowchartResponse): { positionedNodes: NodeWithPosition[], positionedLinks: LinkWithPosition[], bounds: { width: number, height: number } } => {
    const positionedNodes: NodeWithPosition[] = [];
    const positions: { [id: string]: { x: number, y: number } } = {};
    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

    const levels: { [level: number]: string[] } = {};
    const visited = new Set<string>();
    
    function traverse(nodeId: string, level: number) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        if (!levels[level]) levels[level] = [];
        if (!levels[level].includes(nodeId)) {
            levels[level].push(nodeId);
        }

        const outgoingLinks = data.links.filter(l => l.source === nodeId);
        outgoingLinks.forEach(link => traverse(link.target, level + 1));
    }
    
    if (data.nodes.length > 0) {
        traverse(data.nodes[0].id, 0);
    }
    
    const PADDING_X = 120;
    const PADDING_Y = 80;
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 80;

    let maxWidth = 0;
    let maxHeight = 0;

    Object.entries(levels).forEach(([levelStr, nodeIds]) => {
        const level = parseInt(levelStr);
        const y = level * (NODE_HEIGHT + PADDING_Y);
        const levelWidth = nodeIds.length * (NODE_WIDTH + PADDING_X);

        nodeIds.forEach((nodeId, index) => {
            const x = (index * (NODE_WIDTH + PADDING_X)) - (levelWidth / 2);
            positions[nodeId] = { x, y };
        });
    });
    
    // Fallback for unpositioned nodes
    data.nodes.forEach(node => {
        if (!positions[node.id]) positions[node.id] = { x: 0, y: (Object.keys(levels).length) * (NODE_HEIGHT + PADDING_Y) };
    });

    // Center the whole graph
    const allX = Object.values(positions).map(p => p.x);
    const allY = Object.values(positions).map(p => p.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);

    data.nodes.forEach(node => {
        const pos = positions[node.id];
        const finalNode = {
            ...node,
            x: pos.x - minX,
            y: pos.y - minY,
            width: NODE_WIDTH,
            height: node.type === 'rhombus' ? NODE_WIDTH : NODE_HEIGHT,
        };
        positionedNodes.push(finalNode);
        maxWidth = Math.max(maxWidth, finalNode.x + finalNode.width);
        maxHeight = Math.max(maxHeight, finalNode.y + finalNode.height);
    });

    const positionedNodeMap = new Map(positionedNodes.map(n => [n.id, n]));
    const positionedLinks: LinkWithPosition[] = data.links
        .map(link => ({
            ...link,
            source: positionedNodeMap.get(link.source)!,
            target: positionedNodeMap.get(link.target)!,
        }))
        .filter(l => l.source && l.target);

    return { positionedNodes, positionedLinks, bounds: { width: maxWidth, height: maxHeight } };
};


const getEdgePoint = (node: NodeWithPosition, targetCenter: { x: number, y: number }) => {
    const nodeCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    const dx = targetCenter.x - nodeCenter.x;
    const dy = targetCenter.y - nodeCenter.y;

    const halfW = node.width / 2;
    const halfH = node.height / 2;

    if (dx === 0 && dy === 0) return nodeCenter;

    if (node.type === 'rhombus') {
        const angle = Math.atan2(dy, dx);
        const radius = halfW * halfH / Math.sqrt(Math.pow(halfH * Math.cos(angle), 2) + Math.pow(halfW * Math.sin(angle), 2));
        return {
            x: nodeCenter.x + radius * Math.cos(angle),
            y: nodeCenter.y + radius * Math.sin(angle),
        };
    }
    
    const tan = Math.abs(dy / dx);
    const cornerTan = halfH / halfW;

    if (tan < cornerTan) { // Intersects left/right
        return { x: nodeCenter.x + Math.sign(dx) * halfW, y: nodeCenter.y + dy * (halfW / Math.abs(dx)) };
    } else { // Intersects top/bottom
        return { x: nodeCenter.x + dx * (halfH / Math.abs(dy)), y: nodeCenter.y + Math.sign(dy) * halfH };
    }
};

const FlowchartModal: React.FC<FlowchartModalProps> = ({ logText, provider, onClose }) => {
    const [flowchartData, setFlowchartData] = React.useState<{ positionedNodes: NodeWithPosition[], positionedLinks: LinkWithPosition[], bounds: { width: number, height: number } } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [view, setView] = React.useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = React.useState(false);
    const startDragPos = React.useRef({ x: 0, y: 0 });
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const [highlightedNodes, setHighlightedNodes] = React.useState<Set<string>>(new Set());
    const { showToast } = useToast();

    const handleNodeHover = (nodeId: string | null) => {
        if (!nodeId) {
            setHighlightedNodes(new Set());
            return;
        }

        const newHighlights = new Set<string>([nodeId]);
        if (flowchartData) {
            flowchartData.positionedLinks.forEach(link => {
                if (link.source.id === nodeId) newHighlights.add(link.target.id);
                if (link.target.id === nodeId) newHighlights.add(link.source.id);
            });
        }
        setHighlightedNodes(newHighlights);
    };

    React.useEffect(() => {
        const generate = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await generateFlowchartFromText(logText, provider);
                if (data.nodes.length === 0) {
                    throw new Error("AI could not generate a flowchart from the provided text.");
                }
                const layout = layoutFlowchart(data);
                setFlowchartData(layout);
            } catch (err: any) {
                const errorMessage = err.message || 'Failed to generate flowchart.';
                setError(errorMessage);
                showToast(errorMessage, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        generate();
    }, [logText, provider, showToast]);
    
     const resetView = React.useCallback(() => {
        if (!flowchartData || !viewportRef.current) return;
        const { bounds } = flowchartData;
        const { clientWidth, clientHeight } = viewportRef.current;
        const PADDING = 50;

        const scaleX = clientWidth / (bounds.width + PADDING * 2);
        const scaleY = clientHeight / (bounds.height + PADDING * 2);
        const scale = Math.min(scaleX, scaleY, 1);

        const x = (clientWidth - (bounds.width * scale)) / 2;
        const y = (clientHeight - (bounds.height * scale)) / 2;
        
        setView({ x, y, scale });
    }, [flowchartData]);

    React.useEffect(() => {
        if (flowchartData) resetView();
    }, [flowchartData, resetView]);


    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[id^="node-"]')) return;
        setIsDragging(true);
        startDragPos.current = { x: e.clientX - view.x, y: e.clientY - view.y };
        (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setView(prev => ({ ...prev, x: e.clientX - startDragPos.current.x, y: e.clientY - startDragPos.current.y }));
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsDragging(false);
        (e.currentTarget as HTMLElement).style.cursor = 'grab';
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = 0.1;
        const newScale = e.deltaY > 0 ? view.scale - scaleAmount : view.scale + scaleAmount;
        const clampedScale = Math.max(0.1, Math.min(newScale, 2));

        const rect = viewportRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Pan so that the point under the mouse stays in the same place
        const newX = mouseX - (mouseX - view.x) * (clampedScale / view.scale);
        const newY = mouseY - (mouseY - view.y) * (clampedScale / view.scale);

        setView({ x: newX, y: newY, scale: clampedScale });
    };
    
    const zoom = (direction: 'in' | 'out') => {
        const scaleAmount = 0.2;
        const newScale = direction === 'in' ? view.scale + scaleAmount : view.scale - scaleAmount;
        setView(prev => ({...prev, scale: Math.max(0.1, Math.min(newScale, 2))}));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="flowchart" className="w-6 h-6" /> AI-Generated Flowchart
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div 
                    className="flex-1 overflow-hidden relative cursor-grab bg-gray-50 dark:bg-gray-900" 
                    ref={viewportRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <div className="absolute inset-0 bg-repeat bg-center [background-image:radial-gradient(#e5e7eb_1px,transparent_0)] dark:[background-image:radial-gradient(rgba(255,255,255,0.1)_1px,transparent_0)] [background-size:20px_20px]"></div>

                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                                <p className="mt-4 text-gray-600 dark:text-gray-300">Generating flowchart structure with {provider}...</p>
                            </div>
                        </div>
                    )}
                    {error && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-300 p-4 rounded-lg">
                                <p className="font-bold mb-2">Flowchart Generation Error:</p>
                                <pre className="text-xs whitespace-pre-wrap font-mono">{error}</pre>
                            </div>
                        </div>
                    )}
                    
                    {!isLoading && !error && flowchartData && (
                        <div 
                            style={{ 
                                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                                width: flowchartData.bounds.width,
                                height: flowchartData.bounds.height,
                            }}
                            className="absolute top-0 left-0"
                        >
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                                <defs>
                                    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                                    </marker>
                                </defs>
                                {flowchartData.positionedLinks.map((link, i) => {
                                    const sourceCenter = { x: link.source.x + link.source.width / 2, y: link.source.y + link.source.height / 2 };
                                    const targetCenter = { x: link.target.x + link.target.width / 2, y: link.target.y + link.target.height / 2 };
                                    
                                    const start = getEdgePoint(link.source, targetCenter);
                                    const end = getEdgePoint(link.target, sourceCenter);
                                    
                                    const pathData = `M${start.x},${start.y} C${start.x},${start.y + 60} ${end.x},${end.y - 60} ${end.x},${end.y}`;
                                    
                                    const hasHighlights = highlightedNodes.size > 0;
                                    const isHighlighted = hasHighlights && highlightedNodes.has(link.source.id) && highlightedNodes.has(link.target.id);

                                    return (
                                        <g key={i}>
                                            <path
                                                d={pathData}
                                                className={`stroke-current transition-all duration-300 ${
                                                    hasHighlights
                                                        ? isHighlighted ? 'text-blue-500' : 'text-gray-300/30 dark:text-gray-600/30'
                                                        : 'text-gray-300 dark:text-gray-600'
                                                }`}
                                                strokeWidth={isHighlighted ? 3 : 2}
                                                fill="none"
                                                markerEnd="url(#arrow)"
                                            />
                                            {link.label && (
                                                <text 
                                                  x={(start.x + end.x) / 2} 
                                                  y={(start.y + end.y) / 2 - 8} 
                                                  className="fill-current text-gray-600 dark:text-gray-400 transition-opacity" 
                                                  fontSize="12" 
                                                  textAnchor="middle" 
                                                  style={{
                                                    pointerEvents: 'none', 
                                                    opacity: hasHighlights ? (isHighlighted ? 1 : 0.2) : 1
                                                  }}
                                                >{link.label}</text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                            {flowchartData.positionedNodes.map(node => (
                                <div key={node.id} onMouseEnter={() => handleNodeHover(node.id)} onMouseLeave={() => handleNodeHover(null)} className="cursor-pointer">
                                  <FlowchartNodeComponent node={node} highlightedNodes={highlightedNodes} />
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Controls */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <button onClick={() => zoom('in')} className="p-2 bg-white dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-md"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg></button>
                        <button onClick={() => zoom('out')} className="p-2 bg-white dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-md"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg></button>
                        <button onClick={resetView} className="p-2 bg-white dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-md"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h5v5M20 4h-5v5M4 20h5v-5M20 20h-5v-5" /></svg></button>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4 mt-auto flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FlowchartModal;
