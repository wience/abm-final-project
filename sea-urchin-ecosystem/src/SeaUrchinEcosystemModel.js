import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Play, Pause, RotateCcw, Download, Settings, Info, Zap, Fish, Heart, Waves } from 'lucide-react';

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
    tickRate: 100,  // milliseconds between ticks
    speedMultiplier: 1,  // number of simulation steps per tick
    turboMode: false  // skip rendering for maximum speed
  });

  // Sprite styles state
  const [spriteStyle, setSpriteStyle] = useState('default');
  const [customSprites, setCustomSprites] = useState({
    urchin: null,
    harvester: null,
    coral: null,
    algae: null
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

  // UI state
  const [showInfo, setShowInfo] = useState(false);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Performance optimization refs
  const svgRef = useRef(null);
  const layersRef = useRef(null);
  const agentsRef = useRef(null);
  const playingRef = useRef(false);
  const tickRef = useRef(0);
  const statsAccumRef = useRef({
    harvestedCount: 0
  });

  // Sync refs with state
  useEffect(() => { 
    agentsRef.current = agents; 
  }, [agents]);
  
  useEffect(() => { 
    playingRef.current = isRunning; 
  }, [isRunning]);
  
  useEffect(() => { 
    tickRef.current = tick; 
  }, [tick]);

  // Preset configurations
  const presets = {
    balanced: {
      name: 'Balanced Ecosystem',
      icon: '⚖️',
      params: {
        initialUrchins: 30,
        harvesterCount: 3,
        initialCoralCoverage: 40,
        grazingRate: 0.5,
        harvestingRate: 1.0
      }
    },
    overfishing: {
      name: 'Overfishing Scenario',
      icon: '🎣',
      params: {
        initialUrchins: 50,
        harvesterCount: 8,
        initialCoralCoverage: 40,
        grazingRate: 0.5,
        harvestingRate: 3.0
      }
    },
    plague: {
      name: 'Urchin Plague',
      icon: '💀',
      params: {
        initialUrchins: 80,
        harvesterCount: 1,
        initialCoralCoverage: 40,
        grazingRate: 1.5,
        harvestingRate: 0.5
      }
    },
    pristine: {
      name: 'Pristine Reef',
      icon: '🏝️',
      params: {
        initialUrchins: 15,
        harvesterCount: 1,
        initialCoralCoverage: 70,
        grazingRate: 0.3,
        harvestingRate: 0.5
      }
    }
  };

  // Sprite style definitions
  const spriteStyles = {
    default: {
      name: 'Default',
      urchin: { type: 'svg', style: 'spiky' },
      harvester: { type: 'emoji', emoji: '🎣' },
      coral: { type: 'svg', style: 'organic' },
      algae: { type: 'svg', style: 'wavy' }
    },
    emoji: {
      name: 'Emoji',
      urchin: { type: 'emoji', emoji: '🦔' },
      harvester: { type: 'emoji', emoji: '👨‍🌾' },
      coral: { type: 'emoji', emoji: '🪸' },
      algae: { type: 'emoji', emoji: '🌿' }
    },
    realistic: {
      name: 'Realistic',
      urchin: { type: 'svg', style: 'detailed' },
      harvester: { type: 'emoji', emoji: '🤿' },
      coral: { type: 'svg', style: 'branching' },
      algae: { type: 'svg', style: 'seaweed' }
    },
    simple: {
      name: 'Simple',
      urchin: { type: 'svg', style: 'circle' },
      harvester: { type: 'svg', style: 'triangle' },
      coral: { type: 'svg', style: 'star' },
      algae: { type: 'svg', style: 'blob' }
    }
  };

  // Handle sprite image upload
  const handleSpriteUpload = (entity, file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomSprites(prev => ({
          ...prev,
          [entity]: e.target.result
        }));
        setSpriteStyle('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply preset
  const applyPreset = (preset) => {
    setParams(prev => ({
      ...prev,
      ...preset.params
    }));
    // If harvester count is in the preset, update harvesters immediately
    if (preset.params.harvesterCount !== undefined) {
      setTimeout(() => {
        updateHarvesterCount(preset.params.harvesterCount);
      }, 50);
    }
    initializeSimulation();
  };

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
  }, [params.initialUrchins, params.urchinSpeed, params.maturityTime, width, height]);

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
  }, [params.harvesterCount, params.harvesterSpeed, width, height]);

  // Update sea urchin count
  const updateUrchinCount = useCallback((newCount) => {
    setAgents(prevAgents => {
      const currentCount = prevAgents.seaUrchins.length;
      
      if (newCount > currentCount) {
        // Add new urchins
        const newUrchins = [];
        for (let i = currentCount; i < newCount; i++) {
          newUrchins.push({
            id: `urchin-${Date.now()}-${i}`,
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
        return {
          ...prevAgents,
          seaUrchins: [...prevAgents.seaUrchins, ...newUrchins]
        };
      } else if (newCount < currentCount) {
        // Remove excess urchins randomly
        const shuffled = [...prevAgents.seaUrchins].sort(() => Math.random() - 0.5);
        return {
          ...prevAgents,
          seaUrchins: shuffled.slice(0, newCount)
        };
      }
      
      return prevAgents;
    });
  }, [params.urchinSpeed, params.maturityTime, width, height]);

  // Update harvesters when count changes
  const updateHarvesterCount = useCallback((newCount) => {
    setAgents(prevAgents => {
      const currentCount = prevAgents.harvesters.length;
      
      if (newCount > currentCount) {
        // Add new harvesters
        const newHarvesters = [];
        for (let i = currentCount; i < newCount; i++) {
          newHarvesters.push({
            id: `harvester-${Date.now()}-${i}`,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * params.harvesterSpeed,
            vy: (Math.random() - 0.5) * params.harvesterSpeed,
            harvestCount: 0
          });
        }
        return {
          ...prevAgents,
          harvesters: [...prevAgents.harvesters, ...newHarvesters]
        };
      } else if (newCount < currentCount) {
        // Remove excess harvesters
        return {
          ...prevAgents,
          harvesters: prevAgents.harvesters.slice(0, newCount)
        };
      }
      
      return prevAgents;
    });
  }, [params.harvesterSpeed, width, height]);

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
    tickRef.current = 0;
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
    statsAccumRef.current = {
      harvestedCount: 0
    };
    setIsRunning(false);
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

  // Optimized simulation step (no setState, pure mutation)
  const stepSimulation = useCallback(() => {
    if (!agentsRef.current) return;
    
    const currentAgents = agentsRef.current;
    const currentTick = tickRef.current;
    
    // Move and age sea urchins
    currentAgents.seaUrchins.forEach(urchin => {
      moveAgent(urchin, params.urchinSpeed);
      urchin.age++;
      if (urchin.age > params.maturityTime) {
        urchin.isAdult = true;
      }
      urchin.energy = Math.max(0, urchin.energy - 0.1);
      
      // Graze corals
      grazeCorals(urchin, currentAgents.corals);
    });
    
    // Remove starved urchins
    currentAgents.seaUrchins = currentAgents.seaUrchins.filter(u => u.energy > 0);
    
    // Reproduction
    const newUrchins = reproduceUrchins(currentAgents.seaUrchins, currentTick);
    currentAgents.seaUrchins.push(...newUrchins);
    
    // Move harvesters
    currentAgents.harvesters.forEach(harvester => {
      moveAgent(harvester, params.harvesterSpeed, true);
    });
    
    // Harvesting
    const { remainingUrchins, harvestedCount } = harvestUrchins(
      currentAgents.harvesters, 
      currentAgents.seaUrchins
    );
    currentAgents.seaUrchins = remainingUrchins;
    statsAccumRef.current.harvestedCount += harvestedCount;
    
    // Update corals
    const urchinDensity = currentAgents.seaUrchins.length / (gridWidth * gridHeight);
    updateCorals(currentAgents.corals, urchinDensity);
    
    // Increment tick
    tickRef.current++;
    
    // Update state less frequently
    if (tickRef.current % 5 === 0) {
      setTick(tickRef.current);
      
      // Calculate statistics
      const juveniles = currentAgents.seaUrchins.filter(u => !u.isAdult).length;
      const adults = currentAgents.seaUrchins.filter(u => u.isAdult).length;
      const healthy = currentAgents.corals.filter(c => c.status === 'healthy').length;
      const degraded = currentAgents.corals.filter(c => c.status === 'degraded').length;
      const dead = currentAgents.corals.filter(c => c.status === 'dead').length;
      const avgAlgae = currentAgents.corals.reduce((sum, c) => sum + c.algaeLevel, 0) / currentAgents.corals.length;
      
      setStats({
        juvenileUrchins: juveniles,
        adultUrchins: adults,
        totalUrchins: juveniles + adults,
        healthyCorals: healthy,
        degradedCorals: degraded,
        deadCorals: dead,
        algaeCoverage: avgAlgae * 100,
        harvestedUrchins: statsAccumRef.current.harvestedCount
      });
    }
    
    // Update history even less frequently
    if (tickRef.current % 10 === 0 && tickRef.current > 0) {
      const juveniles = currentAgents.seaUrchins.filter(u => !u.isAdult).length;
      const adults = currentAgents.seaUrchins.filter(u => u.isAdult).length;
      const totalUrchins = juveniles + adults;
      const healthy = currentAgents.corals.filter(c => c.status === 'healthy').length;
      const totalCorals = currentAgents.corals.length;
      const coralHealthPercent = totalCorals > 0 ? (healthy / totalCorals) * 100 : 0;
      const avgAlgae = currentAgents.corals.reduce((sum, c) => sum + c.algaeLevel, 0) / currentAgents.corals.length * 100;
      
      setHistory(prev => ({
        ticks: [...prev.ticks, tickRef.current].slice(-100),
        urchinPop: [...prev.urchinPop, totalUrchins].slice(-100),
        coralHealth: [...prev.coralHealth, coralHealthPercent].slice(-100),
        algaeCoverage: [...prev.algaeCoverage, avgAlgae].slice(-100)
      }));
    }
    
  }, [params, gridWidth, gridHeight]);

  // Helper function to render different sprite types
  const renderSprite = (selection, entity, data) => {
    const currentStyle = spriteStyles[spriteStyle] || spriteStyles.default;
    const sprite = currentStyle[entity];
    
    selection.each(function(d) {
      const g = d3.select(this);
      g.selectAll('*').remove(); // Clear previous content
      
      if (spriteStyle === 'custom' && customSprites[entity]) {
        // Render custom uploaded image
        const size = entity === 'coral' ? cellSize * 1.6 : 
                    entity === 'algae' ? cellSize * 1.2 :
                    entity === 'harvester' ? 24 : 
                    d.isAdult ? 20 : 12;
        
        g.append('image')
          .attr('href', customSprites[entity])
          .attr('x', -size/2)
          .attr('y', -size/2)
          .attr('width', size)
          .attr('height', size);
      } else if (sprite.type === 'emoji') {
        // Render emoji
        const size = entity === 'coral' ? '24px' : 
                    entity === 'algae' ? '20px' :
                    entity === 'harvester' ? '20px' : 
                    d.isAdult ? '18px' : '12px';
        
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('font-size', size)
          .style('user-select', 'none')
          .text(sprite.emoji);
      } else {
        // Render SVG shapes based on style
        switch(entity) {
          case 'urchin':
            renderUrchinSprite(g, sprite.style, d);
            break;
          case 'harvester':
            renderHarvesterSprite(g, sprite.style, d);
            break;
          case 'coral':
            renderCoralSprite(g, sprite.style, d);
            break;
          case 'algae':
            renderAlgaeSprite(g, sprite.style, d);
            break;
        }
      }
    });
  };
  
  // Sprite rendering functions
  const renderUrchinSprite = (g, style, d) => {
    const radius = d.isAdult ? 10 : 6;
    
    if (style === 'spiky') {
      // Default spiky urchin
      g.append('circle')
        .attr('r', radius)
        .attr('fill', '#1a1a1a')
        .attr('stroke', '#333')
        .attr('stroke-width', 1);
      
      const spineCount = 8;
      for (let i = 0; i < spineCount; i++) {
        const angle = (i / spineCount) * 2 * Math.PI;
        const spineLength = d.isAdult ? 15 : 9;
        g.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', Math.cos(angle) * spineLength)
          .attr('y2', Math.sin(angle) * spineLength)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
      }
    } else if (style === 'detailed') {
      // Use pooled gradient
      g.append('circle')
        .attr('r', radius)
        .attr('fill', 'url(#urchinGradient)');
      
      const spineCount = 16;
      for (let i = 0; i < spineCount; i++) {
        const angle = (i / spineCount) * 2 * Math.PI;
        const spineLength = (d.isAdult ? 15 : 9) * (0.8 + Math.random() * 0.4);
        g.append('line')
          .attr('x1', Math.cos(angle) * radius * 0.8)
          .attr('y1', Math.sin(angle) * radius * 0.8)
          .attr('x2', Math.cos(angle) * spineLength)
          .attr('y2', Math.sin(angle) * spineLength)
          .attr('stroke', '#2a2a2a')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.8);
      }
    } else if (style === 'circle') {
      // Simple circle
      g.append('circle')
        .attr('r', radius)
        .attr('fill', d.isAdult ? '#2a2a2a' : '#4a4a4a')
        .attr('stroke', '#666')
        .attr('stroke-width', 2);
    }
  };
  
  const renderHarvesterSprite = (g, style, d) => {
    if (style === 'triangle') {
      // Simple triangle
      g.append('polygon')
        .attr('points', '0,-12 -10,8 10,8')
        .attr('fill', '#e74c3c')
        .attr('stroke', '#c0392b')
        .attr('stroke-width', 2);
    } else {
      // Default circle with emoji
      g.append('circle')
        .attr('r', 12)
        .attr('fill', '#e74c3c')
        .attr('opacity', 0.8);
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 4)
        .attr('font-size', '16px')
        .text('🎣');
    }
  };
  
  const renderCoralSprite = (g, style, d) => {
    const baseColor = d.status === 'healthy' ? '#ff6b6b' : 
                     d.status === 'degraded' ? '#966b6b' : '#4a3333';
    const opacity = d.status === 'healthy' ? 0.8 : 
                   d.status === 'degraded' ? 0.6 : 0.4;
    
    if (style === 'organic') {
      // Default organic shape
      const petals = 5;
      for (let i = 0; i < petals; i++) {
        const angle = (i / petals) * 2 * Math.PI;
        const petalSize = cellSize * 0.4;
        g.append('ellipse')
          .attr('cx', Math.cos(angle) * petalSize/2)
          .attr('cy', Math.sin(angle) * petalSize/2)
          .attr('rx', petalSize)
          .attr('ry', petalSize/2)
          .attr('fill', baseColor)
          .attr('opacity', opacity)
          .attr('transform', `rotate(${angle * 180 / Math.PI} ${Math.cos(angle) * petalSize/2} ${Math.sin(angle) * petalSize/2})`);
      }
      g.append('circle')
        .attr('r', cellSize * 0.3)
        .attr('fill', baseColor)
        .attr('opacity', opacity);
    } else if (style === 'branching') {
      // Branching coral
      const branches = 6;
      for (let i = 0; i < branches; i++) {
        const angle = (i / branches) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
        const length = cellSize * 0.6 * (0.7 + Math.random() * 0.3);
        
        g.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', Math.cos(angle) * length)
          .attr('y2', Math.sin(angle) * length)
          .attr('stroke', baseColor)
          .attr('stroke-width', 4)
          .attr('stroke-linecap', 'round')
          .attr('opacity', opacity);
        
        g.append('circle')
          .attr('cx', Math.cos(angle) * length)
          .attr('cy', Math.sin(angle) * length)
          .attr('r', 3)
          .attr('fill', baseColor)
          .attr('opacity', opacity);
      }
      g.append('circle')
        .attr('r', 5)
        .attr('fill', baseColor)
        .attr('opacity', opacity);
    } else if (style === 'star') {
      // Star shape
      const points = 8;
      let pathData = '';
      for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * 2 * Math.PI;
        const radius = i % 2 === 0 ? cellSize * 0.8 : cellSize * 0.4;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        pathData += (i === 0 ? 'M' : 'L') + x + ',' + y;
      }
      pathData += 'Z';
      
      g.append('path')
        .attr('d', pathData)
        .attr('fill', baseColor)
        .attr('opacity', opacity);
    }
  };
  
  const renderAlgaeSprite = (g, style, d) => {
    const size = cellSize * 0.6 * d.algaeLevel;
    
    if (style === 'wavy') {
      // Wavy algae
      for (let j = 0; j < 3; j++) {
        const offset = (j - 1) * 10;
        const path = `M ${offset},0 Q ${offset + size/2},-${size/3} ${offset + size},0 T ${offset + size*1.5},${size/2}`;
        g.append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#2ecc71')
          .attr('stroke-width', 2)
          .attr('opacity', 0.6)
          .attr('transform', `rotate(${j * 120} 0 0)`);
      }
    } else if (style === 'seaweed') {
      // Seaweed style
      for (let i = 0; i < 4; i++) {
        const offsetX = (i - 1.5) * size/3;
        const waveHeight = size * (0.5 + Math.random() * 0.5);
        const path = `M ${offsetX},0 Q ${offsetX + size/4},-${waveHeight/2} ${offsetX},${-waveHeight}`;
        
        g.append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#2ecc71')
          .attr('stroke-width', 2)
          .attr('opacity', 0.5)
          .attr('transform', `rotate(${Math.random() * 30 - 15} 0 0)`);
      }
    } else if (style === 'blob') {
      // Simple blob
      g.append('circle')
        .attr('r', size)
        .attr('fill', '#2ecc71')
        .attr('opacity', 0.5);
    }
  };

  // Initialize SVG and static elements ONCE
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#ocean-gradient)');
    
    // Define gradients and patterns ONCE
    const defs = svg.append('defs');
    
    const oceanGradient = defs.append('linearGradient')
      .attr('id', 'ocean-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    
    oceanGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#001528');
    
    oceanGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#002951');
    
    oceanGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#003d7a');
    
    // Pooled gradient for detailed urchins
    const urchinGradient = defs.append('radialGradient')
      .attr('id', 'urchinGradient')
      .attr('cx', '30%')
      .attr('cy', '30%');
    
    urchinGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4a4a4a');
    
    urchinGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#1a1a1a');
    
    // Add texture filter for corals
    const filter = defs.append('filter')
      .attr('id', 'coral-texture');
    
    filter.append('feTurbulence')
      .attr('baseFrequency', '0.02')
      .attr('numOctaves', '1')
      .attr('result', 'turbulence');
    
    filter.append('feColorMatrix')
      .attr('in', 'turbulence')
      .attr('type', 'saturate')
      .attr('values', '0');
    
    // Create layers ONCE
    layersRef.current = {
      coral: svg.append('g').attr('class', 'coral-layer'),
      algae: svg.append('g').attr('class', 'algae-layer'),
      urchin: svg.append('g').attr('class', 'urchin-layer'),
      harvester: svg.append('g').attr('class', 'harvester-layer')
    };
  }, []); // Empty deps - run only once

  // Render frame function
  const renderFrame = useCallback(() => {
    if (!layersRef.current || !agentsRef.current) return;
    
    const { coral, algae, urchin, harvester } = layersRef.current;
    const currentAgents = agentsRef.current;
    
    // Update corals
    const coralGroups = coral.selectAll('.coral-group')
      .data(currentAgents.corals, d => d.id);
    
    coralGroups.enter()
      .append('g')
      .attr('class', 'coral-group')
      .merge(coralGroups)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .each(function(d) {
        renderSprite(d3.select(this), 'coral', [d]);
      });
    
    coralGroups.exit().remove();
    
    // Update algae
    const algaeData = currentAgents.corals.filter(c => c.algaeLevel > 0.1);
    const algaeGroups = algae.selectAll('.algae-group')
      .data(algaeData, d => d.id);
    
    algaeGroups.enter()
      .append('g')
      .attr('class', 'algae-group')
      .merge(algaeGroups)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .each(function(d) {
        renderSprite(d3.select(this), 'algae', [d]);
      });
    
    algaeGroups.exit().remove();
    
    // Update urchins
    const urchinGroups = urchin.selectAll('.urchin-group')
      .data(currentAgents.seaUrchins, d => d.id);
    
    urchinGroups.enter()
      .append('g')
      .attr('class', 'urchin-group')
      .merge(urchinGroups)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .each(function(d) {
        renderSprite(d3.select(this), 'urchin', [d]);
      });
    
    urchinGroups.exit().remove();
    
    // Update harvesters
    const harvesterGroups = harvester.selectAll('.harvester-group')
      .data(currentAgents.harvesters, d => d.id);
    
    harvesterGroups.enter()
      .append('g')
      .attr('class', 'harvester-group')
      .merge(harvesterGroups)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .each(function(d) {
        renderSprite(d3.select(this), 'harvester', [d]);
      });
    
    harvesterGroups.exit().remove();
  }, [renderSprite]);

  // Main animation loop with decoupled simulation/render rates
  useEffect(() => {
    let animationId;
    let lastStep = performance.now();
    let turboInterval;
    
    function loop(now) {
      if (playingRef.current) {
        // Step physics at tickRate
        if (now - lastStep > params.tickRate) {
          // Run multiple simulation steps based on speed multiplier
          for (let i = 0; i < params.speedMultiplier; i++) {
            stepSimulation();
          }
          lastStep = now;
        }
        
        // Always render at browser frame rate unless in turbo mode
        if (!params.turboMode) {
          renderFrame();
        }
        animationId = requestAnimationFrame(loop);
      }
    }
    
    // Turbo mode - run simulation as fast as possible without rendering
    function turboLoop() {
      if (playingRef.current && params.turboMode) {
        for (let i = 0; i < params.speedMultiplier * 10; i++) {
          stepSimulation();
        }
        // Render occasionally to show progress
        if (tickRef.current % 100 === 0) {
          renderFrame();
        }
      }
    }
    
    if (isRunning) {
      if (params.turboMode) {
        // Use setInterval for turbo mode to bypass RAF limitations
        turboInterval = setInterval(turboLoop, 1);
      } else {
        animationId = requestAnimationFrame(loop);
      }
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (turboInterval) {
        clearInterval(turboInterval);
      }
    };
  }, [isRunning, params.tickRate, params.speedMultiplier, params.turboMode, stepSimulation, renderFrame]);

  // Initialize on mount
  useEffect(() => {
    initializeSimulation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // Export data function
  const exportData = () => {
    const data = {
      parameters: params,
      history: history,
      finalStats: stats,
      spriteStyle: spriteStyle,
      customSpriteUploaded: {
        urchin: !!customSprites.urchin,
        harvester: !!customSprites.harvester,
        coral: !!customSprites.coral,
        algae: !!customSprites.algae
      },
      simulationSpeed: {
        tickRate: params.tickRate,
        speedMultiplier: params.speedMultiplier,
        turboMode: params.turboMode,
        effectiveSpeed: params.turboMode ? params.speedMultiplier * 10 : params.speedMultiplier
      },
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

  // Export visualization as PNG
  const exportAsPNG = () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Set canvas size to match SVG
    canvas.width = width;
    canvas.height = height;
    
    img.onload = () => {
      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Draw the SVG image
      ctx.drawImage(img, 0, 0);
      
      // Convert to PNG and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecosystem-simulation-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(svgUrl);
      }, 'image/png');
    };
    
    img.src = svgUrl;
  };

  // Export visualization as SVG
  const exportAsSVG = () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current.cloneNode(true);
    
    // Add title and metadata
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Sea Urchin-Coral Reef Ecosystem Simulation';
    svg.insertBefore(title, svg.firstChild);
    
    const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    desc.textContent = `Simulation at tick ${tick} - ${new Date().toLocaleString()}`;
    svg.insertBefore(desc, svg.firstChild.nextSibling);
    
    // Serialize and download
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecosystem-simulation-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export chart as PNG
  const exportChartAsPNG = () => {
    const chartSvg = document.querySelector('.chart-svg');
    if (!chartSvg) return;
    
    const svgData = new XMLSerializer().serializeToString(chartSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Set canvas size to match SVG
    const width = parseInt(chartSvg.getAttribute('width'));
    const height = parseInt(chartSvg.getAttribute('height'));
    canvas.width = width;
    canvas.height = height;
    
    img.onload = () => {
      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Draw the SVG image
      ctx.drawImage(img, 0, 0);
      
      // Convert to PNG and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecosystem-chart-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(svgUrl);
      }, 'image/png');
    };
    
    img.src = svgUrl;
  };

  // Export comprehensive report with chart, state, and parameters
  const exportComprehensiveReport = () => {
    // Prepare comprehensive data
    const report = {
      metadata: {
        title: 'Sea Urchin-Coral Reef Ecosystem Report',
        generated: new Date().toISOString(),
        simulationTick: tick,
        version: '1.0'
      },
      currentState: {
        urchins: {
          total: stats.totalUrchins,
          juveniles: stats.juvenileUrchins,
          adults: stats.adultUrchins
        },
        corals: {
          healthy: stats.healthyCorals,
          degraded: stats.degradedCorals,
          dead: stats.deadCorals,
          healthPercentage: ((stats.healthyCorals / (stats.healthyCorals + stats.degradedCorals + stats.deadCorals)) * 100).toFixed(2)
        },
        algae: {
          coveragePercentage: stats.algaeCoverage.toFixed(2)
        },
        harvesting: {
          totalHarvested: stats.harvestedUrchins
        }
      },
      parameters: {
        seaUrchins: {
          initialPopulation: params.initialUrchins,
          reproductionRate: params.reproductionRate,
          grazingRate: params.grazingRate,
          movementSpeed: params.urchinSpeed,
          maturityTime: params.maturityTime,
          spawnRadius: params.spawnRadius
        },
        harvesters: {
          count: params.harvesterCount,
          harvestingRate: params.harvestingRate,
          speed: params.harvesterSpeed,
          harvestRadius: params.harvestRadius
        },
        corals: {
          initialCoverage: params.initialCoralCoverage,
          healingRate: params.coralHealingRate,
          degradationThreshold: params.coralDegradationThreshold
        },
        algae: {
          growthRate: params.algaeGrowthRate,
          maxDensity: params.maxAlgaeDensity
        },
        simulation: {
          tickRate: params.tickRate,
          speedMultiplier: params.speedMultiplier,
          turboMode: params.turboMode
        }
      },
      timeSeries: {
        ticks: history.ticks,
        urchinPopulation: history.urchinPop,
        coralHealthPercentage: history.coralHealth,
        algaeCoveragePercentage: history.algaeCoverage
      },
      analysis: {
        averageUrchins: history.urchinPop.length > 0 ? (history.urchinPop.reduce((a, b) => a + b, 0) / history.urchinPop.length).toFixed(2) : 0,
        averageCoralHealth: history.coralHealth.length > 0 ? (history.coralHealth.reduce((a, b) => a + b, 0) / history.coralHealth.length).toFixed(2) : 0,
        maxUrchins: Math.max(...history.urchinPop, 0),
        minUrchins: Math.min(...history.urchinPop, Infinity),
        trend: {
          urchins: history.urchinPop.length > 1 ? (history.urchinPop[history.urchinPop.length - 1] > history.urchinPop[0] ? 'increasing' : 'decreasing') : 'stable',
          coralHealth: history.coralHealth.length > 1 ? (history.coralHealth[history.coralHealth.length - 1] > history.coralHealth[0] ? 'improving' : 'degrading') : 'stable'
        }
      }
    };

    // Create a formatted text report alongside JSON
    const textReport = `
SEA URCHIN-CORAL REEF ECOSYSTEM REPORT
======================================
Generated: ${new Date().toLocaleString()}
Simulation Tick: ${tick}

CURRENT ECOSYSTEM STATE
-----------------------
Sea Urchins:
  • Total: ${stats.totalUrchins}
  • Juveniles: ${stats.juvenileUrchins}
  • Adults: ${stats.adultUrchins}
  
Coral Reef:
  • Healthy: ${stats.healthyCorals}
  • Degraded: ${stats.degradedCorals}
  • Dead: ${stats.deadCorals}
  • Overall Health: ${report.currentState.corals.healthPercentage}%
  
Algae Coverage: ${stats.algaeCoverage.toFixed(1)}%
Total Harvested: ${stats.harvestedUrchins}

SIMULATION PARAMETERS
---------------------
Sea Urchin Settings:
  • Initial Population: ${params.initialUrchins}
  • Reproduction Rate: ${(params.reproductionRate * 100).toFixed(0)}%
  • Grazing Rate: ${params.grazingRate}
  • Movement Speed: ${params.urchinSpeed}
  • Maturity Time: ${params.maturityTime} ticks

Harvester Settings:
  • Number of Harvesters: ${params.harvesterCount}
  • Harvesting Rate: ${params.harvestingRate}
  • Harvester Speed: ${params.harvesterSpeed}

Coral & Algae Settings:
  • Initial Coverage: ${params.initialCoralCoverage}%
  • Healing Rate: ${(params.coralHealingRate * 100).toFixed(0)}%
  • Algae Growth Rate: ${(params.algaeGrowthRate * 100).toFixed(0)}%

Simulation Speed:
  • Tick Rate: ${params.tickRate}ms
  • Speed Multiplier: ${params.speedMultiplier}x
  • Turbo Mode: ${params.turboMode ? 'Enabled' : 'Disabled'}
  • Effective Speed: ${params.turboMode ? params.speedMultiplier * 10 : params.speedMultiplier}x

ANALYSIS SUMMARY
----------------
• Average Urchin Population: ${report.analysis.averageUrchins}
• Average Coral Health: ${report.analysis.averageCoralHealth}%
• Population Range: ${report.analysis.minUrchins} - ${report.analysis.maxUrchins}
• Urchin Trend: ${report.analysis.trend.urchins}
• Coral Health Trend: ${report.analysis.trend.coralHealth}

DATA POINTS: ${history.ticks.length}
`;

    // Create downloadable files
    const jsonBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const textBlob = new Blob([textReport], { type: 'text/plain' });
    
    // Create a zip-like approach by downloading both files
    const timestamp = Date.now();
    
    // Download JSON
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `ecosystem-report-${timestamp}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);
    
    // Download text report with slight delay
    setTimeout(() => {
      const textUrl = URL.createObjectURL(textBlob);
      const textLink = document.createElement('a');
      textLink.href = textUrl;
      textLink.download = `ecosystem-report-${timestamp}.txt`;
      document.body.appendChild(textLink);
      textLink.click();
      document.body.removeChild(textLink);
      URL.revokeObjectURL(textUrl);
    }, 100);
  };

  // Export time series data as CSV
  const exportTimeSeriesCSV = () => {
    // Create CSV header
    let csv = 'Tick,Urchin Population,Coral Health %,Algae Coverage %\n';
    
    // Add data rows
    for (let i = 0; i < history.ticks.length; i++) {
      csv += `${history.ticks[i]},${history.urchinPop[i]},${history.coralHealth[i].toFixed(2)},${history.algaeCoverage[i].toFixed(2)}\n`;
    }
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ecosystem-timeseries-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export all data as comprehensive CSV
  const exportComprehensiveCSV = () => {
    // Parameters section
    let csv = 'ECOSYSTEM SIMULATION DATA\n';
    csv += `Generated,${new Date().toISOString()}\n`;
    csv += `Simulation Tick,${tick}\n\n`;
    
    csv += 'CURRENT STATE\n';
    csv += 'Metric,Value\n';
    csv += `Total Urchins,${stats.totalUrchins}\n`;
    csv += `Juvenile Urchins,${stats.juvenileUrchins}\n`;
    csv += `Adult Urchins,${stats.adultUrchins}\n`;
    csv += `Healthy Corals,${stats.healthyCorals}\n`;
    csv += `Degraded Corals,${stats.degradedCorals}\n`;
    csv += `Dead Corals,${stats.deadCorals}\n`;
    csv += `Coral Health %,${((stats.healthyCorals / (stats.healthyCorals + stats.degradedCorals + stats.deadCorals)) * 100).toFixed(2)}\n`;
    csv += `Algae Coverage %,${stats.algaeCoverage.toFixed(2)}\n`;
    csv += `Total Harvested,${stats.harvestedUrchins}\n\n`;
    
    csv += 'PARAMETERS\n';
    csv += 'Parameter,Value\n';
    csv += `Initial Urchins,${params.initialUrchins}\n`;
    csv += `Reproduction Rate,${params.reproductionRate}\n`;
    csv += `Grazing Rate,${params.grazingRate}\n`;
    csv += `Urchin Speed,${params.urchinSpeed}\n`;
    csv += `Maturity Time,${params.maturityTime}\n`;
    csv += `Harvester Count,${params.harvesterCount}\n`;
    csv += `Harvesting Rate,${params.harvestingRate}\n`;
    csv += `Harvester Speed,${params.harvesterSpeed}\n`;
    csv += `Initial Coral Coverage,${params.initialCoralCoverage}\n`;
    csv += `Coral Healing Rate,${params.coralHealingRate}\n`;
    csv += `Algae Growth Rate,${params.algaeGrowthRate}\n`;
    csv += `Tick Rate,${params.tickRate}\n`;
    csv += `Speed Multiplier,${params.speedMultiplier}\n`;
    csv += `Turbo Mode,${params.turboMode}\n\n`;
    
    csv += 'TIME SERIES DATA\n';
    csv += 'Tick,Urchin Population,Coral Health %,Algae Coverage %\n';
    
    // Add time series data
    for (let i = 0; i < history.ticks.length; i++) {
      csv += `${history.ticks[i]},${history.urchinPop[i]},${history.coralHealth[i].toFixed(2)},${history.algaeCoverage[i].toFixed(2)}\n`;
    }
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ecosystem-full-data-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Chart component
  const PopulationChart = () => {
    const chartRef = useRef(null);
    const svgInitialized = useRef(false);
    
    useEffect(() => {
      if (!chartRef.current || history.ticks.length === 0) return;
      
      const margin = { top: 20, right: 60, bottom: 50, left: 50 };
      const chartWidth = 500 - margin.left - margin.right;
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
        g.append('path').attr('class', 'line-urchin').attr('fill', 'none').attr('stroke', '#00ffcc').attr('stroke-width', 3);
        g.append('path').attr('class', 'line-coral').attr('fill', 'none').attr('stroke', '#ff6b8a').attr('stroke-width', 3);
        g.append('path').attr('class', 'line-algae').attr('fill', 'none').attr('stroke', '#00d474').attr('stroke-width', 3);
        
        // Add axis labels
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', 0 - margin.left)
          .attr('x', 0 - (chartHeight / 2))
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('fill', '#00ffcc')
          .style('font-size', '12px')
          .style('font-weight', '600')
          .text('Urchin Population');
        
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', chartWidth + 45)
          .attr('x', 0 - (chartHeight / 2))
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('fill', '#ff6b8a')
          .style('font-size', '12px')
          .style('font-weight', '600')
          .text('Percentage (%)');
        
        g.append('text')
          .attr('y', chartHeight + 40)
          .attr('x', chartWidth / 2)
          .style('text-anchor', 'middle')
          .style('fill', '#94a3b8')
          .style('font-size', '12px')
          .style('font-weight', '600')
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
        .selectAll('text').style('fill', '#94a3b8');
      g.select('.y-axis').call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text').style('fill', '#94a3b8');
      g.select('.y-axis2').call(d3.axisRight(yScale2).ticks(5))
        .selectAll('text').style('fill', '#94a3b8');
      
      // Style axis lines
      g.selectAll('.domain').style('stroke', '#475569');
      g.selectAll('.tick line').style('stroke', '#475569');
      
      // Update lines
      const urchinLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale(d))
        .curve(d3.curveMonotoneX);
      
      const coralLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale2(d))
        .curve(d3.curveMonotoneX);
      
      const algaeLine = d3.line()
        .x((d, i) => xScale(history.ticks[i]))
        .y(d => yScale2(d))
        .curve(d3.curveMonotoneX);
      
      g.select('.line-urchin').datum(history.urchinPop).attr('d', urchinLine);
      g.select('.line-coral').datum(history.coralHealth).attr('d', coralLine);
      g.select('.line-algae').datum(history.algaeCoverage).attr('d', algaeLine);
        
    }, [history.ticks, history.urchinPop, history.coralHealth, history.algaeCoverage]);
    
    return <svg ref={chartRef} className="chart-svg"></svg>;
  };

  // Custom slider component
  const CustomSlider = ({ label, value, onChange, min, max, step, unit, color = 'cyan' }) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const colorMap = {
      cyan: '#00ffcc',
      orange: '#ff7f50',
      pink: '#ff6b8a',
      green: '#00d474',
      purple: '#a855f7',
      yellow: '#facc15'
    };
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-300">{label}</label>
          <span className={`text-sm font-mono font-bold`} style={{ color: colorMap[color] }}>
            {typeof value === 'number' && value < 1 && value > 0 ? `${(value * 100).toFixed(0)}%` : `${value}${unit || ''}`}
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step || 1}
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, ${colorMap[color]} 0%, ${colorMap[color]} ${percentage}%, #374151 ${percentage}%, #374151 100%)`
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${lowPerformanceMode ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950'} text-white`}>
      {/* Animated background */}
      {!lowPerformanceMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-teal-500/5"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-5xl font-bold mb-3 ${lowPerformanceMode ? 'text-cyan-400' : 'bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent animate-gradient'}`}>
            Sea Urchin-Coral Reef Ecosystem
          </h1>
          <p className="text-lg text-gray-400 flex items-center justify-center gap-2">
            <Waves className="w-5 h-5" />
            Agent-Based Model for Mactan, Cebu Marine Conservation
          </p>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`${lowPerformanceMode ? 'bg-cyan-900/20' : 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg'} rounded-2xl p-4 border border-cyan-500/20 ${!lowPerformanceMode && 'transform hover:scale-105'} transition-all`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-300 font-medium">Total Urchins</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.totalUrchins}</p>
              </div>
              <div className="text-3xl">🦔</div>
            </div>
          </div>
          <div className={`${lowPerformanceMode ? 'bg-pink-900/20' : 'bg-gradient-to-br from-pink-500/10 to-pink-600/10 backdrop-blur-lg'} rounded-2xl p-4 border border-pink-500/20 ${!lowPerformanceMode && 'transform hover:scale-105'} transition-all`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-pink-300 font-medium">Coral Health</p>
                <p className="text-2xl font-bold text-pink-400">
                  {(stats.healthyCorals + stats.degradedCorals + stats.deadCorals) > 0 
                    ? ((stats.healthyCorals / (stats.healthyCorals + stats.degradedCorals + stats.deadCorals)) * 100).toFixed(0)
                    : '0'}%
                </p>
              </div>
              <div className="text-3xl">🪸</div>
            </div>
          </div>
          <div className={`${lowPerformanceMode ? 'bg-green-900/20' : 'bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-lg'} rounded-2xl p-4 border border-green-500/20 ${!lowPerformanceMode && 'transform hover:scale-105'} transition-all`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300 font-medium">Algae Coverage</p>
                <p className="text-2xl font-bold text-green-400">{stats.algaeCoverage.toFixed(0)}%</p>
              </div>
              <div className="text-3xl">🌿</div>
            </div>
          </div>
          <div className={`${lowPerformanceMode ? 'bg-orange-900/20' : 'bg-gradient-to-br from-orange-500/10 to-orange-600/10 backdrop-blur-lg'} rounded-2xl p-4 border border-orange-500/20 ${!lowPerformanceMode && 'transform hover:scale-105'} transition-all`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-300 font-medium">Harvested</p>
                <p className="text-2xl font-bold text-orange-400">{stats.harvestedUrchins}</p>
              </div>
              <div className="text-3xl">🎣</div>
            </div>
          </div>
        </div>

        {/* Preset Scenarios */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-3 justify-center">
            {Object.entries(presets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(preset)}
                className={`px-4 py-2 ${lowPerformanceMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-slate-700/50 to-slate-600/50 backdrop-blur-lg'} rounded-full border border-slate-500/30 hover:from-slate-600/50 hover:to-slate-500/50 transition-all flex items-center gap-2 group`}
              >
                <span className={`text-lg ${!lowPerformanceMode && 'group-hover:scale-125'} transition-transform`}>{preset.icon}</span>
                <span className="text-sm font-medium">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Simulation Controls */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Simulation Control
                </h3>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    isRunning 
                      ? `bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 ${!lowPerformanceMode && 'shadow-lg shadow-red-500/25'}`
                      : `bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 ${!lowPerformanceMode && 'shadow-lg shadow-cyan-500/25'}`
                  }`}
                >
                  {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isRunning ? 'Pause Simulation' : 'Start Simulation'}
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={initializeSimulation}
                    className="py-2 px-3 rounded-xl font-medium bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 transition-all flex items-center justify-center gap-1 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                  <div className="relative export-menu-container">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="w-full py-2 px-3 rounded-xl font-medium bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-1 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    {showExportMenu && (
                      <div className="absolute top-full mt-2 right-0 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-10">
                        <div className="px-3 py-2 text-xs text-gray-400 font-semibold bg-slate-900">Data Exports</div>
                        <button
                          onClick={() => {
                            exportData();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-blue-400">📊</span> Parameters & Stats (JSON)
                        </button>
                        <button
                          onClick={() => {
                            exportTimeSeriesCSV();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-green-400">📈</span> Time Series (CSV)
                        </button>
                        <button
                          onClick={() => {
                            exportComprehensiveCSV();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-emerald-400">📋</span> Everything (CSV)
                        </button>
                        <button
                          onClick={() => {
                            exportComprehensiveReport();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-purple-400">📑</span> Full Report (JSON + TXT)
                        </button>
                        <div className="border-t border-slate-700 my-1"></div>
                        <div className="px-3 py-2 text-xs text-gray-400 font-semibold bg-slate-900">Visual Exports</div>
                        <button
                          onClick={() => {
                            exportAsPNG();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-pink-400">🖼️</span> Simulation View (PNG)
                        </button>
                        <button
                          onClick={() => {
                            exportAsSVG();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-yellow-400">📐</span> Simulation View (SVG)
                        </button>
                        <button
                          onClick={() => {
                            exportChartAsPNG();
                            setShowExportMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span className="text-red-400">📉</span> Population Chart (PNG)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Speed Presets */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <button
                    onClick={() => setParams({...params, tickRate: 100, speedMultiplier: 1, turboMode: false})}
                    className={`py-1 px-2 rounded-lg text-xs font-medium transition-all ${
                      params.tickRate === 100 && params.speedMultiplier === 1 && !params.turboMode
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-300'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setParams({...params, tickRate: 50, speedMultiplier: 2, turboMode: false})}
                    className={`py-1 px-2 rounded-lg text-xs font-medium transition-all ${
                      params.tickRate === 50 && params.speedMultiplier === 2 && !params.turboMode
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-300'
                    }`}
                  >
                    Fast
                  </button>
                  <button
                    onClick={() => setParams({...params, tickRate: 10, speedMultiplier: 10, turboMode: false})}
                    className={`py-1 px-2 rounded-lg text-xs font-medium transition-all ${
                      params.tickRate === 10 && params.speedMultiplier === 10 && !params.turboMode
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-300'
                    }`}
                  >
                    Ultra
                  </button>
                  <button
                    onClick={() => setParams({...params, tickRate: 1, speedMultiplier: 50, turboMode: true})}
                    className={`py-1 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                      params.turboMode
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-300'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    Turbo
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <CustomSlider
                  label="Simulation Speed"
                  value={params.tickRate}
                  onChange={(e) => setParams({...params, tickRate: parseInt(e.target.value)})}
                  min={1}
                  max={500}
                  step={10}
                  unit="ms"
                  color="purple"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">Lower = Faster</p>
                
                <div className="mt-4">
                  <CustomSlider
                    label="Speed Multiplier"
                    value={params.speedMultiplier}
                    onChange={(e) => setParams({...params, speedMultiplier: parseInt(e.target.value)})}
                    min={1}
                    max={100}
                    step={1}
                    unit="x"
                    color="yellow"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">Steps per tick</p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Turbo Mode
                    </span>
                    <input
                      type="checkbox"
                      checked={params.turboMode}
                      onChange={(e) => setParams({...params, turboMode: e.target.checked})}
                      className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Ultra-fast simulation (minimal rendering)</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-900/50 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Simulation Time</span>
                  <span className="font-mono font-bold text-cyan-400">Tick {tick}</span>
                </div>
                {(params.speedMultiplier > 1 || params.turboMode) && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-400">Effective Speed</span>
                    <span className="font-mono font-bold text-yellow-400 flex items-center gap-1">
                      {params.turboMode ? (
                        <>
                          <Zap className="w-3 h-3" />
                          {params.speedMultiplier * 10}x TURBO
                        </>
                      ) : (
                        `${params.speedMultiplier}x`
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-400">Low Performance Mode</span>
                  <input
                    type="checkbox"
                    checked={lowPerformanceMode}
                    onChange={(e) => setLowPerformanceMode(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                  />
                </label>
              </div>
            </div>

            {/* Sea Urchin Parameters */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-lg font-bold mb-4 text-cyan-400 flex items-center gap-2">
                <span>🦔</span> Sea Urchin Parameters
              </h3>
              <div className="space-y-4">
                <div className="space-y-4">
                  <CustomSlider
                    label="Initial Population"
                    value={params.initialUrchins}
                    onChange={(e) => setParams({...params, initialUrchins: parseInt(e.target.value)})}
                    min={10}
                    max={100}
                    unit=""
                    color="cyan"
                  />
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <span className="text-xs text-gray-400">Current: {agents.seaUrchins.length}</span>
                    <button
                      onClick={() => updateUrchinCount(agents.seaUrchins.length + 10)}
                      className="ml-auto px-2 py-1 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded transition-colors"
                    >
                      +10
                    </button>
                    <button
                      onClick={() => updateUrchinCount(Math.max(0, agents.seaUrchins.length - 10))}
                      className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                    >
                      -10
                    </button>
                  </div>
                </div>
                <CustomSlider
                  label="Reproduction Rate"
                  value={params.reproductionRate}
                  onChange={(e) => setParams({...params, reproductionRate: parseFloat(e.target.value)})}
                  min={0}
                  max={0.2}
                  step={0.01}
                  unit=""
                  color="cyan"
                />
                <CustomSlider
                  label="Grazing Rate"
                  value={params.grazingRate}
                  onChange={(e) => setParams({...params, grazingRate: parseFloat(e.target.value)})}
                  min={0.1}
                  max={2}
                  step={0.1}
                  unit=""
                  color="cyan"
                />
                <CustomSlider
                  label="Movement Speed"
                  value={params.urchinSpeed}
                  onChange={(e) => setParams({...params, urchinSpeed: parseFloat(e.target.value)})}
                  min={0.1}
                  max={2}
                  step={0.1}
                  unit=""
                  color="cyan"
                />
                <CustomSlider
                  label="Maturity Time"
                  value={params.maturityTime}
                  onChange={(e) => setParams({...params, maturityTime: parseInt(e.target.value)})}
                  min={50}
                  max={200}
                  step={10}
                  unit=" ticks"
                  color="cyan"
                />
              </div>
            </div>

            {/* Harvester Parameters */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-lg font-bold mb-4 text-orange-400 flex items-center gap-2">
                <span>🎣</span> Harvester Parameters
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <CustomSlider
                    label="Number of Harvesters"
                    value={params.harvesterCount}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value);
                      setParams({...params, harvesterCount: newCount});
                      updateHarvesterCount(newCount);
                    }}
                    min={0}
                    max={10}
                    unit=""
                    color="orange"
                  />
                  <div className="text-xs text-gray-400 bg-slate-900/50 rounded px-2 py-1">
                    Current: {agents.harvesters.length} harvesters
                  </div>
                </div>
                <CustomSlider
                  label="Harvesting Rate"
                  value={params.harvestingRate}
                  onChange={(e) => setParams({...params, harvestingRate: parseFloat(e.target.value)})}
                  min={0}
                  max={5}
                  step={0.1}
                  unit=""
                  color="orange"
                />
                <CustomSlider
                  label="Harvester Speed"
                  value={params.harvesterSpeed}
                  onChange={(e) => setParams({...params, harvesterSpeed: parseFloat(e.target.value)})}
                  min={0.5}
                  max={3}
                  step={0.1}
                  unit=""
                  color="orange"
                />
              </div>
            </div>

            {/* Coral Parameters */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-lg font-bold mb-4 text-pink-400 flex items-center gap-2">
                <span>🪸</span> Coral & Algae Parameters
              </h3>
              <div className="space-y-4">
                <CustomSlider
                  label="Initial Coverage"
                  value={params.initialCoralCoverage}
                  onChange={(e) => setParams({...params, initialCoralCoverage: parseInt(e.target.value)})}
                  min={10}
                  max={80}
                  unit="%"
                  color="pink"
                />
                <CustomSlider
                  label="Healing Rate"
                  value={params.coralHealingRate}
                  onChange={(e) => setParams({...params, coralHealingRate: parseFloat(e.target.value)})}
                  min={0}
                  max={0.1}
                  step={0.01}
                  unit=""
                  color="pink"
                />
                <CustomSlider
                  label="Algae Growth Rate"
                  value={params.algaeGrowthRate}
                  onChange={(e) => setParams({...params, algaeGrowthRate: parseFloat(e.target.value)})}
                  min={0}
                  max={0.1}
                  step={0.01}
                  unit=""
                  color="green"
                />
              </div>
            </div>

            {/* Visual Settings */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-lg font-bold mb-4 text-yellow-400 flex items-center gap-2">
                <span>🎨</span> Visual Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Sprite Style</label>
                  <select
                    value={spriteStyle}
                    onChange={(e) => setSpriteStyle(e.target.value)}
                    className="w-full p-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:border-yellow-400/50 focus:outline-none transition-colors"
                  >
                    <option value="default">Default</option>
                    <option value="emoji">Emoji</option>
                    <option value="realistic">Realistic</option>
                    <option value="simple">Simple</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                {spriteStyle === 'custom' && (
                  <div className="space-y-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-gray-400">Upload custom sprites (PNG/JPG):</p>
                    {['urchin', 'harvester', 'coral', 'algae'].map(entity => (
                      <div key={entity} className="flex items-center justify-between">
                        <label className="text-xs text-gray-400 capitalize">{entity}:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSpriteUpload(entity, e.target.files[0])}
                          className="text-xs w-32 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-yellow-500/20 file:text-yellow-400 hover:file:bg-yellow-500/30"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Visualization Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Main Simulation */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/30' : 'bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-400" />
                Ecosystem Simulation
              </h3>
              <div className="relative overflow-hidden rounded-xl">
                <svg
                  ref={svgRef}
                  width={width}
                  height={height}
                  className="w-full h-auto"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  viewBox={`0 0 ${width} ${height}`}
                />
                {/* Overlay stats */}
                <div className={`absolute top-4 right-4 ${lowPerformanceMode ? 'bg-slate-900/80' : 'bg-slate-900/80 backdrop-blur-lg'} rounded-xl p-3 border border-slate-700/50`}>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className={`w-4 h-4 ${params.turboMode ? 'text-yellow-400 animate-pulse' : 'text-yellow-400'}`} />
                    <span className={`font-mono ${params.turboMode ? 'text-yellow-400' : 'text-yellow-400'}`}>
                      {isRunning ? (params.turboMode ? 'TURBO' : 'Running') : 'Paused'}
                    </span>
                  </div>
                  {params.speedMultiplier > 1 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {params.turboMode ? `${params.speedMultiplier * 10}x` : `${params.speedMultiplier}x`} speed
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Detailed Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`${lowPerformanceMode ? 'bg-cyan-900/20' : 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg'} rounded-xl p-4 border border-cyan-500/20`}>
                <h4 className="text-xs text-cyan-300 font-medium mb-1">Juvenile Urchins</h4>
                <div className="text-2xl font-bold text-cyan-400">{stats.juvenileUrchins}</div>
              </div>
              <div className={`${lowPerformanceMode ? 'bg-cyan-900/20' : 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg'} rounded-xl p-4 border border-cyan-500/20`}>
                <h4 className="text-xs text-cyan-300 font-medium mb-1">Adult Urchins</h4>
                <div className="text-2xl font-bold text-cyan-400">{stats.adultUrchins}</div>
              </div>
              <div className={`${lowPerformanceMode ? 'bg-pink-900/20' : 'bg-gradient-to-br from-pink-500/10 to-pink-600/10 backdrop-blur-lg'} rounded-xl p-4 border border-pink-500/20`}>
                <h4 className="text-xs text-pink-300 font-medium mb-1">Healthy Corals</h4>
                <div className="text-2xl font-bold text-pink-400">{stats.healthyCorals}</div>
              </div>
              <div className={`${lowPerformanceMode ? 'bg-yellow-900/20' : 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 backdrop-blur-lg'} rounded-xl p-4 border border-yellow-500/20`}>
                <h4 className="text-xs text-yellow-300 font-medium mb-1">Degraded Corals</h4>
                <div className="text-2xl font-bold text-yellow-400">{stats.degradedCorals}</div>
              </div>
            </div>
            
            {/* Population Chart */}
            <div className={`${lowPerformanceMode ? 'bg-slate-800/30' : 'bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-lg'} rounded-2xl p-6 border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-400" />
                  Population Dynamics
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={exportChartAsPNG}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                    title="Export chart as PNG"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={exportComprehensiveReport}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all text-sm font-medium flex items-center gap-1"
                    title="Export comprehensive report with graph, current state, and all parameters"
                  >
                    <Download className="w-4 h-4" />
                    Full Report
                  </button>
                </div>
              </div>
              <div className="flex justify-center">
                <PopulationChart />
              </div>
              <div className="flex gap-6 mt-6 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded"></div>
                  <span className="text-sm text-gray-300">Sea Urchins</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-pink-400 to-pink-600 rounded"></div>
                  <span className="text-sm text-gray-300">Coral Health %</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-600 rounded"></div>
                  <span className="text-sm text-gray-300">Algae Coverage %</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Modal */}
        {showInfo && (
          <div className={`fixed inset-0 ${lowPerformanceMode ? 'bg-black/50' : 'bg-black/50 backdrop-blur-sm'} flex items-center justify-center z-50 p-6`}>
            <div className={`${lowPerformanceMode ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-800 to-slate-900'} rounded-2xl p-8 max-w-2xl max-h-[80vh] overflow-y-auto border border-slate-700/50 ${!lowPerformanceMode && 'shadow-2xl'}`}>
              <h3 className="text-2xl font-bold mb-4 text-cyan-400">About This Simulation</h3>
              <div className="space-y-4 text-gray-300">
                <p>
                  This agent-based model simulates the complex interactions between sea urchins, coral reefs, and human harvesting activities in the marine ecosystem of Mactan, Cebu.
                </p>
                <div>
                  <h4 className="font-semibold text-white mb-2">Key Components:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><span className="text-cyan-400">Sea Urchins:</span> Graze on corals and algae, reproduce when conditions are favorable</li>
                    <li><span className="text-pink-400">Coral Reefs:</span> Provide habitat, can heal when grazing pressure is low</li>
                    <li><span className="text-green-400">Algae:</span> Grows on degraded corals, controlled by urchin grazing</li>
                    <li><span className="text-orange-400">Harvesters:</span> Remove adult urchins from the ecosystem</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Conservation Insights:</h4>
                  <p>
                    Finding the right balance between urchin populations and harvesting is crucial for coral reef health. Too many urchins can overgraze corals, while too few allow algae to overgrow and smother the reef.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Export Options:</h4>
                  <p>
                    Multiple export formats are available via the Export button:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><span className="text-blue-400">JSON:</span> Complete parameters and statistics for reimporting</li>
                    <li><span className="text-green-400">CSV:</span> Time series data for analysis in Excel or R</li>
                    <li><span className="text-purple-400">Full Report:</span> Comprehensive data including graph, state, and parameters</li>
                    <li><span className="text-pink-400">PNG/SVG:</span> Visual exports of the simulation or charts</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Speed Controls:</h4>
                  <p>
                    The simulation offers multiple speed options:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><span className="text-cyan-400">Normal:</span> Standard speed for observing interactions</li>
                    <li><span className="text-cyan-400">Fast:</span> 2x speed with 50ms tick rate</li>
                    <li><span className="text-cyan-400">Ultra:</span> 10x speed for rapid testing</li>
                    <li><span className="text-yellow-400">Turbo Mode:</span> 500x speed with minimal rendering for ultra-fast simulation</li>
                  </ul>
                  <p className="mt-2">
                    Use the Speed Multiplier slider and Turbo Mode toggle for custom speeds up to 1000x normal speed.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Live Adjustments:</h4>
                  <p>
                    You can now adjust key parameters during simulation without resetting:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><span className="text-orange-400">Harvester Count:</span> Add or remove harvesters in real-time</li>
                    <li><span className="text-cyan-400">Urchin Population:</span> Use +10/-10 buttons to manually adjust population</li>
                    <li>Other parameters update simulation behavior immediately</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Performance Mode:</h4>
                  <p>
                    Enable "Low Performance Mode" if you experience lag. This disables visual effects while maintaining full simulation functionality.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="mt-6 px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-xl font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #00ffcc 0%, #00d4aa 100%);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: ${lowPerformanceMode ? 'none' : '0 2px 10px rgba(0, 255, 204, 0.5)'};
          transition: all 0.3s ease;
        }
        
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: ${lowPerformanceMode ? 'none' : '0 2px 20px rgba(0, 255, 204, 0.7)'};
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #00ffcc 0%, #00d4aa 100%);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: ${lowPerformanceMode ? 'none' : '0 2px 10px rgba(0, 255, 204, 0.5)'};
          transition: all 0.3s ease;
          border: none;
        }
        
        .slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: ${lowPerformanceMode ? 'none' : '0 2px 20px rgba(0, 255, 204, 0.7)'};
        }
      `}</style>
    </div>
  );
};

export default SeaUrchinEcosystemModel;