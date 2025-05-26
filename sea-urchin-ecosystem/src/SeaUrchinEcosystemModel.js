import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

const SeaUrchinEcosystemModel = () => {
  // Simulation dimensions
  const width = 800;
  const height = 600;
  const cellSize = 20;
  const gridWidth = Math.floor(width / cellSize);
  const gridHeight = Math.floor(height / cellSize);

  // Initial states
  const [isRunning, setIsRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [agents, setAgents] = useState({
    seaUrchins: [],
    harvesters: [],
    corals: [],
    algae: []
  });

  // Parameters state
  const [params, setParams] = useState({
    // Sea Urchin parameters
    initialUrchins: 30,
    reproductionRate: 0.05,
    grazingRate: 0.5,
    urchinSpeed: 0.5,
    maturityTime: 100,
    spawnRadius: 50,
    
    // Harvester parameters
    harvesterCount: 3,
    harvestingRate: 1.0,
    harvesterSpeed: 1.0,
    harvestRadius: 30,
    
    // Coral parameters
    initialCoralCoverage: 40,
    coralHealingRate: 0.02,
    coralDegradationThreshold: 50,
    
    // Algae parameters
    algaeGrowthRate: 0.03,
    maxAlgaeDensity: 0.8,
    
    // Simulation parameters
    tickRate: 100  // milliseconds between ticks
  });

  // Statistics state
  const [stats, setStats] = useState({
    juvenileUrchins: 0,
    adultUrchins: 0,
    totalUrchins: 0,
    healthyCorals: 0,
    degradedCorals: 0,
    deadCorals: 0,
    algaeCoverage: 0,
    harvestedUrchins: 0
  });

  // History for charts
  const [history, setHistory] = useState({
    ticks: [],
    urchinPop: [],
    coralHealth: [],
    algaeCoverage: []
  });

  const svgRef = useRef(null);

  // Initialize coral reef grid
  const initializeCorals = useCallback(() => {
    const corals = [];
    const coverage = params.initialCoralCoverage / 100;
    
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        if (Math.random() < coverage) {
          corals.push({
            id: `coral-${x}-${y}`,
            x: x * cellSize + cellSize / 2,
            y: y * cellSize + cellSize / 2,
            health: 100,
            algaeLevel: 0,
            status: 'healthy' // healthy, degraded, dead
          });
        }
      }
    }
    return corals;
  }, [params.initialCoralCoverage, gridWidth, gridHeight]);

  // Initialize sea urchins
  const initializeUrchins = useCallback(() => {
    const urchins = [];
    for (let i = 0; i < params.initialUrchins; i++) {
      urchins.push({
        id: `urchin-${i}`,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * params.urchinSpeed,
        vy: (Math.random() - 0.5) * params.urchinSpeed,
        age: Math.random() > 0.5 ? params.maturityTime + 1 : 0,
        isAdult: Math.random() > 0.5,
        energy: 50,
        lastSpawn: 0
      });
    }
    return urchins;
  }, [params.initialUrchins, params.urchinSpeed, params.maturityTime]);

  // Initialize harvesters
  const initializeHarvesters = useCallback(() => {
    const harvesters = [];
    for (let i = 0; i < params.harvesterCount; i++) {
      harvesters.push({
        id: `harvester-${i}`,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * params.harvesterSpeed,
        vy: (Math.random() - 0.5) * params.harvesterSpeed,
        harvestCount: 0
      });
    }
    return harvesters;
  }, [params.harvesterCount, params.harvesterSpeed]);

  // Initialize simulation
  const initializeSimulation = useCallback(() => {
    const newAgents = {
      seaUrchins: initializeUrchins(),
      harvesters: initializeHarvesters(),
      corals: initializeCorals(),
      algae: []
    };
    setAgents(newAgents);
    setTick(0);
    setHistory({
      ticks: [],
      urchinPop: [],
      coralHealth: [],
      algaeCoverage: []
    });
    setStats({
      juvenileUrchins: 0,
      adultUrchins: 0,
      totalUrchins: 0,
      healthyCorals: 0,
      degradedCorals: 0,
      deadCorals: 0,
      algaeCoverage: 0,
      harvestedUrchins: 0
    });
  }, [initializeUrchins, initializeHarvesters, initializeCorals]);

  // Movement behavior
  const moveAgent = (agent, speed, isHarvester = false) => {
    // Random walk with momentum
    agent.vx += (Math.random() - 0.5) * speed * 0.1;
    agent.vy += (Math.random() - 0.5) * speed * 0.1;
    
    // Speed limit
    const maxSpeed = speed * 2;
    const currentSpeed = Math.sqrt(agent.vx * agent.vx + agent.vy * agent.vy);
    if (currentSpeed > maxSpeed) {
      agent.vx = (agent.vx / currentSpeed) * maxSpeed;
      agent.vy = (agent.vy / currentSpeed) * maxSpeed;
    }
    
    // Update position
    agent.x += agent.vx;
    agent.y += agent.vy;
    
    // Bounce off walls
    if (agent.x < 0 || agent.x > width) {
      agent.vx *= -1;
      agent.x = Math.max(0, Math.min(width, agent.x));
    }
    if (agent.y < 0 || agent.y > height) {
      agent.vy *= -1;
      agent.y = Math.max(0, Math.min(height, agent.y));
    }
  };

  // Sea urchin grazing behavior
  const grazeCorals = (urchin, corals) => {
    corals.forEach(coral => {
      const distance = Math.sqrt(
        Math.pow(urchin.x - coral.x, 2) + 
        Math.pow(urchin.y - coral.y, 2)
      );
      
      if (distance < cellSize && coral.status !== 'dead') {
        // Graze coral
        coral.health -= params.grazingRate;
        urchin.energy += params.grazingRate * 0.5;
        
        // Update coral status
        if (coral.health <= 0) {
          coral.status = 'dead';
          coral.health = 0;
        } else if (coral.health < params.coralDegradationThreshold) {
          coral.status = 'degraded';
        }
        
        // Control algae growth
        coral.algaeLevel = Math.max(0, coral.algaeLevel - params.grazingRate * 0.3);
      }
    });
  };

  // Sea urchin reproduction (proximity broadcast spawning)
  const reproduceUrchins = (urchins, currentTick) => {
    const newUrchins = [];
    const adults = urchins.filter(u => u.isAdult);
    
    adults.forEach(urchin => {
      if (urchin.energy > 60 && currentTick - urchin.lastSpawn > 50) {
        // Check for nearby adults
        const nearbyAdults = adults.filter(other => {
          if (other.id === urchin.id) return false;
          const distance = Math.sqrt(
            Math.pow(urchin.x - other.x, 2) + 
            Math.pow(urchin.y - other.y, 2)
          );
          return distance < params.spawnRadius;
        });
        
        if (nearbyAdults.length > 0 && Math.random() < params.reproductionRate) {
          // Spawn new urchin
          newUrchins.push({
            id: `urchin-${Date.now()}-${Math.random()}`,
            x: urchin.x + (Math.random() - 0.5) * 20,
            y: urchin.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * params.urchinSpeed,
            vy: (Math.random() - 0.5) * params.urchinSpeed,
            age: 0,
            isAdult: false,
            energy: 30,
            lastSpawn: currentTick
          });
          
          urchin.energy -= 20;
          urchin.lastSpawn = currentTick;
        }
      }
    });
    
    return newUrchins;
  };

  // Harvesting behavior
  const harvestUrchins = (harvesters, urchins) => {
    const remainingUrchins = [...urchins];
    let harvestedCount = 0;
    
    harvesters.forEach(harvester => {
      // Find nearby adult urchins
      const targets = remainingUrchins.filter(urchin => {
        if (!urchin.isAdult) return false;
        const distance = Math.sqrt(
          Math.pow(harvester.x - urchin.x, 2) + 
          Math.pow(harvester.y - urchin.y, 2)
        );
        return distance < params.harvestRadius;
      });
      
      if (targets.length > 0 && Math.random() < params.harvestingRate * 0.1) {
        // Harvest closest urchin
        targets.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(harvester.x - a.x, 2) + Math.pow(harvester.y - a.y, 2));
          const distB = Math.sqrt(Math.pow(harvester.x - b.x, 2) + Math.pow(harvester.y - b.y, 2));
          return distA - distB;
        });
        
        const targetIndex = remainingUrchins.indexOf(targets[0]);
        if (targetIndex !== -1) {
          remainingUrchins.splice(targetIndex, 1);
          harvester.harvestCount++;
          harvestedCount++;
        }
      }
    });
    
    return { remainingUrchins, harvestedCount };
  };

  // Coral healing and algae growth
  const updateCorals = (corals, urchinDensity) => {
    corals.forEach(coral => {
      if (coral.status !== 'dead') {
        // Heal if low grazing pressure
        if (urchinDensity < 0.5) {
          coral.health = Math.min(100, coral.health + params.coralHealingRate);
          
          if (coral.health > params.coralDegradationThreshold) {
            coral.status = 'healthy';
          }
        }
        
        // Algae growth on degraded/dead corals
        if (coral.status === 'degraded' || coral.status === 'dead') {
          coral.algaeLevel = Math.min(
            params.maxAlgaeDensity, 
            coral.algaeLevel + params.algaeGrowthRate
          );
        }
      }
    });
  };

  // Optimize simulation step
  const simulationStep = useCallback(() => {
    if (!isRunning) return;
    
    setAgents(prevAgents => {
      try {
        // Create new arrays only when needed
        const newAgents = {
          seaUrchins: prevAgents.seaUrchins,
          harvesters: prevAgents.harvesters,
          corals: prevAgents.corals,
          algae: prevAgents.algae
        };
        
        // Batch updates for sea urchins
        const updatedUrchins = newAgents.seaUrchins.map(urchin => {
          const updatedUrchin = { ...urchin };
          moveAgent(updatedUrchin, params.urchinSpeed);
          updatedUrchin.age++;
          if (updatedUrchin.age > params.maturityTime) {
            updatedUrchin.isAdult = true;
          }
          updatedUrchin.energy = Math.max(0, updatedUrchin.energy - 0.1);
          return updatedUrchin;
        });
        
        // Filter starved urchins
        newAgents.seaUrchins = updatedUrchins.filter(u => u.energy > 0);
        
        // Batch coral updates
        const coralUpdates = newAgents.corals.map(coral => {
          const updatedCoral = { ...coral };
          if (updatedCoral.status !== 'dead') {
            const urchinDensity = newAgents.seaUrchins.length / (gridWidth * gridHeight);
            if (urchinDensity < 0.5) {
              updatedCoral.health = Math.min(100, updatedCoral.health + params.coralHealingRate);
              if (updatedCoral.health > params.coralDegradationThreshold) {
                updatedCoral.status = 'healthy';
              }
            }
            if (updatedCoral.status === 'degraded' || updatedCoral.status === 'dead') {
              updatedCoral.algaeLevel = Math.min(
                params.maxAlgaeDensity,
                updatedCoral.algaeLevel + params.algaeGrowthRate
              );
            }
          }
          return updatedCoral;
        });
        
        newAgents.corals = coralUpdates;
        
        // Batch harvester updates
        const updatedHarvesters = newAgents.harvesters.map(harvester => {
          const updatedHarvester = { ...harvester };
          moveAgent(updatedHarvester, params.harvesterSpeed, true);
          return updatedHarvester;
        });
        
        newAgents.harvesters = updatedHarvesters;
        
        // Process harvesting in a single pass
        const { remainingUrchins, harvestedCount } = harvestUrchins(
          newAgents.harvesters,
          newAgents.seaUrchins
        );
        newAgents.seaUrchins = remainingUrchins;
        
        // Update statistics in a single pass
        const stats = {
          juvenileUrchins: 0,
          adultUrchins: 0,
          healthyCorals: 0,
          degradedCorals: 0,
          deadCorals: 0,
          algaeCoverage: 0
        };
        
        newAgents.seaUrchins.forEach(urchin => {
          if (urchin.isAdult) stats.adultUrchins++;
          else stats.juvenileUrchins++;
        });
        
        newAgents.corals.forEach(coral => {
          if (coral.status === 'healthy') stats.healthyCorals++;
          else if (coral.status === 'degraded') stats.degradedCorals++;
          else if (coral.status === 'dead') stats.deadCorals++;
          stats.algaeCoverage += coral.algaeLevel;
        });
        
        stats.algaeCoverage = (stats.algaeCoverage / newAgents.corals.length) * 100;
        
        setStats(prevStats => ({
          ...stats,
          totalUrchins: stats.juvenileUrchins + stats.adultUrchins,
          harvestedUrchins: prevStats.harvestedUrchins + harvestedCount
        }));
        
        return newAgents;
      } catch (error) {
        console.error('Error in simulation step:', error);
        return prevAgents;
      }
    });
    
    setTick(prev => prev + 1);
  }, [isRunning, params, gridWidth, gridHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update history for charts
  useEffect(() => {
    if (tick % 10 === 0 && tick > 0) {
      const totalCorals = stats.healthyCorals + stats.degradedCorals + stats.deadCorals;
      const coralHealthPercent = totalCorals > 0 ? (stats.healthyCorals / totalCorals) * 100 : 0;
      
      setHistory(prev => ({
        ticks: [...prev.ticks, tick].slice(-100),
        urchinPop: [...prev.urchinPop, stats.totalUrchins].slice(-100),
        coralHealth: [...prev.coralHealth, coralHealthPercent].slice(-100),
        algaeCoverage: [...prev.algaeCoverage, stats.algaeCoverage].slice(-100)
      }));
    }
  }, [tick, stats]);

  // Optimize D3 visualization updates
  const SimulationVisualization = React.memo(({ agents, width, height, cellSize }) => {
    const svgRef = useRef(null);
    const prevAgentsRef = useRef(agents);
    
    useEffect(() => {
      if (!svgRef.current) return;
      
      // Only update if agents have actually changed
      if (JSON.stringify(agents) === JSON.stringify(prevAgentsRef.current)) {
        return;
      }
      
      prevAgentsRef.current = agents;
      
      const svg = d3.select(svgRef.current);
      
      // Use D3's data join pattern for better performance
      const updateVisualization = () => {
        // Update corals
        const coralSelection = svg.select('.coral-layer')
          .selectAll('.coral')
          .data(agents.corals, d => d.id);
          
        coralSelection.exit().remove();
        
        const coralEnter = coralSelection.enter()
          .append('circle')
          .attr('class', d => `coral ${d.status}`);
        
        coralSelection.merge(coralEnter)
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
          .attr('r', cellSize * 0.8)
          .attr('fill', d => {
            if (d.status === 'healthy') return '#ff6b6b';
            if (d.status === 'degraded') return '#966b6b';
            return '#4a3333';
          })
          .attr('opacity', d => {
            if (d.status === 'healthy') return 0.8;
            if (d.status === 'degraded') return 0.6;
            return 0.4;
          });
        
        // Update algae
        const algaeSelection = svg.select('.coral-layer')
          .selectAll('.algae')
          .data(agents.corals.filter(c => c.algaeLevel > 0.1), d => d.id);
        
        algaeSelection.exit().remove();
        
        const algaeEnter = algaeSelection.enter()
          .append('circle')
          .attr('class', 'algae');
        
        algaeSelection.merge(algaeEnter)
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
          .attr('r', d => cellSize * 0.6 * d.algaeLevel)
          .attr('fill', '#2ecc71')
          .attr('opacity', 0.5);
        
        // Update sea urchins
        const urchinSelection = svg.select('.urchin-layer')
          .selectAll('.urchin-group')
          .data(agents.seaUrchins, d => d.id);
        
        urchinSelection.exit().remove();
        
        const urchinEnter = urchinSelection.enter()
          .append('g')
          .attr('class', 'urchin-group');
        
        urchinEnter.append('circle')
          .attr('class', d => `sea-urchin ${d.isAdult ? 'adult' : 'juvenile'}`)
          .attr('r', d => d.isAdult ? 10 : 6)
          .attr('fill', '#1a1a1a')
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        
        // Add spines to new urchins
        urchinEnter.each(function(d) {
          const group = d3.select(this);
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const spineLength = d.isAdult ? 15 : 9;
            group.append('line')
              .attr('x1', 0)
              .attr('y1', 0)
              .attr('x2', Math.cos(angle) * spineLength)
              .attr('y2', Math.sin(angle) * spineLength)
              .attr('stroke', '#333')
              .attr('stroke-width', 1);
          }
        });
        
        urchinSelection.merge(urchinEnter)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Update harvesters
        const harvesterSelection = svg.select('.harvester-layer')
          .selectAll('.harvester')
          .data(agents.harvesters, d => d.id);
        
        harvesterSelection.exit().remove();
        
        const harvesterEnter = harvesterSelection.enter()
          .append('g')
          .attr('class', 'harvester');
        
        harvesterEnter.append('circle')
          .attr('r', 12)
          .attr('fill', '#e74c3c')
          .attr('opacity', 0.8);
        
        harvesterEnter.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 4)
          .attr('font-size', '16px')
          .text('🎣');
        
        harvesterSelection.merge(harvesterEnter)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);
      };
      
      // Initial setup
      if (!svg.select('.coral-layer').size()) {
        svg.append('rect')
          .attr('width', width)
          .attr('height', height)
          .attr('fill', 'url(#ocean-gradient)');
          
        const defs = svg.append('defs');
        const oceanGradient = defs.append('linearGradient')
          .attr('id', 'ocean-gradient')
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');
          
        oceanGradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', '#0a192f');
          
        oceanGradient.append('stop')
          .attr('offset', '50%')
          .attr('stop-color', '#1e3a5f');
          
        oceanGradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#2a4365');
          
        svg.append('g').attr('class', 'coral-layer');
        svg.append('g').attr('class', 'urchin-layer');
        svg.append('g').attr('class', 'harvester-layer');
      }
      
      updateVisualization();
    }, [agents, width, height, cellSize]);
    
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-slate-600 rounded"
      />
    );
  });

  SimulationVisualization.displayName = 'SimulationVisualization';

  // Add frame rate limiting
  const [lastFrameTime, setLastFrameTime] = useState(0);
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  // Optimize animation loop
  useEffect(() => {
    if (!isRunning) return;
    
    let animationFrameId;
    let lastTime = performance.now();
    
    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime >= frameInterval) {
        simulationStep();
        lastTime = currentTime;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isRunning, simulationStep]);

  // Add error boundary component
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      console.error('Error in component:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="p-4 bg-red-900 text-white rounded-lg">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-red-700 rounded hover:bg-red-600"
            >
              Try again
            </button>
          </div>
        );
      }

      return this.props.children;
    }
  }

  // Add loading state
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
    </div>
  );

  // Optimize parameter updates with a shorter debounce time and change detection
  const debouncedSetParams = useCallback(
    debounce((newParams) => {
      setParams(prevParams => {
        // Only update if values have actually changed
        const hasChanges = Object.keys(newParams).some(
          key => prevParams[key] !== newParams[key]
        );
        return hasChanges ? newParams : prevParams;
      });
    }, 50), // Reduced from 300ms to 50ms
    []
  );

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  // Update initialization
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await initializeSimulation();
      } catch (error) {
        console.error('Error initializing simulation:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Export data function
  const exportData = () => {
    const data = {
      parameters: params,
      history: history,
      finalStats: stats,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecosystem-simulation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extract PopulationChart component
  const PopulationChart = React.memo(({ history }) => {
    const chartRef = useRef(null);
    const svgInitialized = useRef(false);
    
    useEffect(() => {
      if (!chartRef.current || history.ticks.length === 0) return;
      
      const margin = { top: 20, right: 60, bottom: 50, left: 50 };
      const chartWidth = 600 - margin.left - margin.right;
      const chartHeight = 200 - margin.top - margin.bottom;
      
      const svg = d3.select(chartRef.current);
      
      // Initialize SVG only once
      if (!svgInitialized.current) {
        svg.attr('width', chartWidth + margin.left + margin.right)
           .attr('height', chartHeight + margin.top + margin.bottom);
        
        const g = svg.append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`)
          .attr('class', 'chart-group');
        
        // Add axes groups
        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${chartHeight})`);
        g.append('g').attr('class', 'y-axis');
        g.append('g').attr('class', 'y-axis2').attr('transform', `translate(${chartWidth},0)`);
        
        // Add line paths
        g.append('path').attr('class', 'line-urchin').attr('fill', 'none').attr('stroke', '#64ffda').attr('stroke-width', 2);
        g.append('path').attr('class', 'line-coral').attr('fill', 'none').attr('stroke', '#ff6b6b').attr('stroke-width', 2);
        g.append('path').attr('class', 'line-algae').attr('fill', 'none').attr('stroke', '#2ecc71').attr('stroke-width', 2);
        
        // Add axis labels
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', 0 - margin.left)
          .attr('x', 0 - (chartHeight / 2))
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('fill', '#64ffda')
          .style('font-size', '12px')
          .text('Urchin Population');
        
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', chartWidth + 40)
          .attr('x', 0 - (chartHeight / 2))
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('fill', '#ff6b6b')
          .style('font-size', '12px')
          .text('Percentage (%)');
        
        g.append('text')
          .attr('y', chartHeight + 40)
          .attr('x', chartWidth / 2)
          .style('text-anchor', 'middle')
          .style('fill', '#9ca3af')
          .style('font-size', '12px')
          .text('Time (ticks)');
        
        svgInitialized.current = true;
      }
      
      const g = svg.select('.chart-group');
      
      // Update scales
      const xScale = d3.scaleLinear()
        .domain([Math.min(...history.ticks), Math.max(...history.ticks)])
        .range([0, chartWidth]);
      
      const yScale = d3.scaleLinear()
        .domain([0, Math.max(...history.urchinPop, 10)])
        .range([chartHeight, 0]);
      
      const yScale2 = d3.scaleLinear()
        .domain([0, 100])
        .range([chartHeight, 0]);
      
      // Update axes
      g.select('.x-axis').call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text').style('fill', '#9ca3af');
      g.select('.y-axis').call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text').style('fill', '#9ca3af');
      g.select('.y-axis2').call(d3.axisRight(yScale2).ticks(5))
        .selectAll('text').style('fill', '#9ca3af');
      
      // Style axis lines
      g.selectAll('.domain').style('stroke', '#4b5563');
      g.selectAll('.tick line').style('stroke', '#4b5563');
      
      // Update lines
      const urchinLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale(d));
      
      const coralLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale2(d));
      
      const algaeLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale2(d));
      
      g.select('.line-urchin').datum(history.urchinPop).attr('d', urchinLine);
      g.select('.line-coral').datum(history.coralHealth).attr('d', coralLine);
      g.select('.line-algae').datum(history.algaeCoverage).attr('d', algaeLine);
        
    }, [history.ticks, history.urchinPop, history.coralHealth, history.algaeCoverage]);
    
    return <svg ref={chartRef}></svg>;
  });

  PopulationChart.displayName = 'PopulationChart';

  // Control Panel Components
  const SeaUrchinControls = React.memo(({ params, setParams }) => (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4 text-cyan-400 flex items-center gap-2">
        <span>🦔</span> Sea Urchin Parameters
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400">Initial Population</label>
          <input
            type="range"
            min="10"
            max="100"
            value={params.initialUrchins}
            onChange={(e) => setParams({...params, initialUrchins: parseInt(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-cyan-400 font-mono">{params.initialUrchins}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Reproduction Rate</label>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.01"
            value={params.reproductionRate}
            onChange={(e) => setParams({...params, reproductionRate: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-cyan-400 font-mono">{(params.reproductionRate * 100).toFixed(0)}%</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Grazing Rate</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={params.grazingRate}
            onChange={(e) => setParams({...params, grazingRate: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-cyan-400 font-mono">{params.grazingRate.toFixed(1)}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Movement Speed</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={params.urchinSpeed}
            onChange={(e) => setParams({...params, urchinSpeed: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-cyan-400 font-mono">{params.urchinSpeed.toFixed(1)}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Maturity Time (ticks)</label>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={params.maturityTime}
            onChange={(e) => setParams({...params, maturityTime: parseInt(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-cyan-400 font-mono">{params.maturityTime}</div>
        </div>
      </div>
    </div>
  ));

  SeaUrchinControls.displayName = 'SeaUrchinControls';

  const HarvesterControls = React.memo(({ params, setParams }) => (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4 text-orange-400 flex items-center gap-2">
        <span>🎣</span> Harvester Parameters
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400">Number of Harvesters</label>
          <input
            type="range"
            min="0"
            max="10"
            value={params.harvesterCount}
            onChange={(e) => setParams({...params, harvesterCount: parseInt(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-orange-400 font-mono">{params.harvesterCount}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Harvesting Rate</label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={params.harvestingRate}
            onChange={(e) => setParams({...params, harvestingRate: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-orange-400 font-mono">{params.harvestingRate.toFixed(1)}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Harvester Speed</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={params.harvesterSpeed}
            onChange={(e) => setParams({...params, harvesterSpeed: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-orange-400 font-mono">{params.harvesterSpeed.toFixed(1)}</div>
        </div>
      </div>
    </div>
  ));

  HarvesterControls.displayName = 'HarvesterControls';

  const CoralControls = React.memo(({ params, setParams }) => (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4 text-pink-400 flex items-center gap-2">
        <span>🪸</span> Coral Parameters
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400">Initial Coverage (%)</label>
          <input
            type="range"
            min="10"
            max="80"
            value={params.initialCoralCoverage}
            onChange={(e) => setParams({...params, initialCoralCoverage: parseInt(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-pink-400 font-mono">{params.initialCoralCoverage}%</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Healing Rate</label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.01"
            value={params.coralHealingRate}
            onChange={(e) => setParams({...params, coralHealingRate: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-pink-400 font-mono">{params.coralHealingRate.toFixed(2)}</div>
        </div>
        <div>
          <label className="text-sm text-gray-400">Algae Growth Rate</label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.01"
            value={params.algaeGrowthRate}
            onChange={(e) => setParams({...params, algaeGrowthRate: parseFloat(e.target.value)})}
            className="w-full"
          />
          <div className="text-right text-green-400 font-mono">{params.algaeGrowthRate.toFixed(2)}</div>
        </div>
      </div>
    </div>
  ));

  CoralControls.displayName = 'CoralControls';

  const SimulationControls = React.memo(({ params, setParams, isRunning, setIsRunning, initializeSimulation, exportData }) => (
    <>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-purple-400 flex items-center gap-2">
          <span>⚙️</span> Simulation Settings
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400">Simulation Speed (ms/tick)</label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={params.tickRate}
              onChange={(e) => setParams({...params, tickRate: parseInt(e.target.value)})}
              className="w-full"
            />
            <div className="text-right text-purple-400 font-mono">{params.tickRate}ms</div>
            <div className="text-xs text-gray-500 mt-1">Lower = Faster</div>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
            isRunning 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-cyan-600 hover:bg-cyan-700'
          }`}
        >
          {isRunning ? 'Pause Simulation' : 'Start Simulation'}
        </button>
        <button
          onClick={initializeSimulation}
          className="w-full py-3 px-4 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 transition-all"
        >
          Reset Simulation
        </button>
        <button
          onClick={exportData}
          className="w-full py-3 px-4 rounded-lg font-semibold bg-green-600 hover:bg-green-700 transition-all"
        >
          Export Data
        </button>
      </div>
    </>
  ));

  SimulationControls.displayName = 'SimulationControls';

  const StatisticsDisplay = React.memo(({ stats }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Juvenile Urchins</h4>
        <div className="text-2xl font-bold text-cyan-400">{stats.juvenileUrchins}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Adult Urchins</h4>
        <div className="text-2xl font-bold text-cyan-400">{stats.adultUrchins}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Healthy Corals</h4>
        <div className="text-2xl font-bold text-pink-400">{stats.healthyCorals}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Harvested</h4>
        <div className="text-2xl font-bold text-orange-400">{stats.harvestedUrchins}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Degraded Corals</h4>
        <div className="text-2xl font-bold text-yellow-400">{stats.degradedCorals}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Dead Corals</h4>
        <div className="text-2xl font-bold text-red-400">{stats.deadCorals}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Algae Coverage</h4>
        <div className="text-2xl font-bold text-green-400">{stats.algaeCoverage.toFixed(1)}%</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Total Urchins</h4>
        <div className="text-2xl font-bold text-cyan-400">{stats.totalUrchins}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm text-gray-400 mb-1">Coral Health %</h4>
        <div className="text-2xl font-bold text-pink-400">
          {(stats.healthyCorals + stats.degradedCorals + stats.deadCorals) > 0 
            ? ((stats.healthyCorals / (stats.healthyCorals + stats.degradedCorals + stats.deadCorals)) * 100).toFixed(1)
            : '0.0'}%
        </div>
      </div>
    </div>
  ));

  StatisticsDisplay.displayName = 'StatisticsDisplay';

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Sea Urchin-Coral Reef Ecosystem Model
          </h1>
          <p className="text-center text-gray-400 mb-8">Agent-Based Model for Mactan, Cebu</p>
          
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Control Panel */}
              <div className="lg:col-span-1 space-y-6">
                <SeaUrchinControls params={params} setParams={debouncedSetParams} />
                <HarvesterControls params={params} setParams={debouncedSetParams} />
                <CoralControls params={params} setParams={debouncedSetParams} />
                <SimulationControls 
                  params={params} 
                  setParams={debouncedSetParams} 
                  isRunning={isRunning} 
                  setIsRunning={setIsRunning}
                  initializeSimulation={initializeSimulation}
                  exportData={exportData}
                />
              </div>
              
              {/* Visualization Area */}
              <div className="lg:col-span-3 space-y-6">
                {/* Main Simulation */}
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Ecosystem Simulation (Tick: {tick})</h3>
                  <SimulationVisualization 
                    agents={agents}
                    width={width}
                    height={height}
                    cellSize={cellSize}
                  />
                </div>
                
                {/* Statistics */}
                <StatisticsDisplay stats={stats} />
                
                {/* Population Chart */}
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Population Dynamics</h3>
                  <PopulationChart history={history} />
                  <div className="flex gap-6 mt-4 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-cyan-400 rounded"></div>
                      <span className="text-sm">Sea Urchins</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-pink-400 rounded"></div>
                      <span className="text-sm">Coral Health %</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-400 rounded"></div>
                      <span className="text-sm">Algae Coverage %</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default SeaUrchinEcosystemModel;