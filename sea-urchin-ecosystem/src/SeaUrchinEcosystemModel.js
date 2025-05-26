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
    tickRate: 100  // milliseconds between ticks
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

  const svgRef = useRef(null);

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

  // Main simulation step
  const simulationStep = useCallback(() => {
    if (!isRunning) return;
    
    setAgents(prevAgents => {
      const newAgents = {
        seaUrchins: [...prevAgents.seaUrchins],
        harvesters: [...prevAgents.harvesters],
        corals: [...prevAgents.corals],
        algae: [...prevAgents.algae]
      };
      
      // Move and age sea urchins
      newAgents.seaUrchins.forEach(urchin => {
        moveAgent(urchin, params.urchinSpeed);
        urchin.age++;
        if (urchin.age > params.maturityTime) {
          urchin.isAdult = true;
        }
        urchin.energy = Math.max(0, urchin.energy - 0.1);
        
        // Graze corals
        grazeCorals(urchin, newAgents.corals);
      });
      
      // Remove starved urchins
      newAgents.seaUrchins = newAgents.seaUrchins.filter(u => u.energy > 0);
      
      // Reproduction
      const newUrchins = reproduceUrchins(newAgents.seaUrchins, tick);
      newAgents.seaUrchins.push(...newUrchins);
      
      // Move harvesters
      newAgents.harvesters.forEach(harvester => {
        moveAgent(harvester, params.harvesterSpeed, true);
      });
      
      // Harvesting
      const { remainingUrchins, harvestedCount } = harvestUrchins(
        newAgents.harvesters, 
        newAgents.seaUrchins
      );
      newAgents.seaUrchins = remainingUrchins;
      
      // Update corals
      const urchinDensity = newAgents.seaUrchins.length / (gridWidth * gridHeight);
      updateCorals(newAgents.corals, urchinDensity);
      
      // Update statistics
      const juveniles = newAgents.seaUrchins.filter(u => !u.isAdult).length;
      const adults = newAgents.seaUrchins.filter(u => u.isAdult).length;
      const healthy = newAgents.corals.filter(c => c.status === 'healthy').length;
      const degraded = newAgents.corals.filter(c => c.status === 'degraded').length;
      const dead = newAgents.corals.filter(c => c.status === 'dead').length;
      const avgAlgae = newAgents.corals.reduce((sum, c) => sum + c.algaeLevel, 0) / newAgents.corals.length;
      
      setStats(prevStats => ({
        juvenileUrchins: juveniles,
        adultUrchins: adults,
        totalUrchins: juveniles + adults,
        healthyCorals: healthy,
        degradedCorals: degraded,
        deadCorals: dead,
        algaeCoverage: avgAlgae * 100,
        harvestedUrchins: prevStats.harvestedUrchins + harvestedCount
      }));
      
      return newAgents;
    });
    
    setTick(prev => prev + 1);
  }, [isRunning, tick, params, gridWidth, gridHeight]);

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

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#ocean-gradient)');
    
    // Define gradients and patterns
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
    
    // Helper function to render different sprite types
    const renderSprite = (selection, entity, data) => {
      const currentStyle = spriteStyles[spriteStyle] || spriteStyles.default;
      const sprite = currentStyle[entity];
      
      if (spriteStyle === 'custom' && customSprites[entity]) {
        // Render custom uploaded image
        selection.each(function(d) {
          const g = d3.select(this);
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
        });
      } else if (sprite.type === 'emoji') {
        // Render emoji
        selection.each(function(d) {
          const g = d3.select(this);
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
        });
      } else {
        // Render SVG shapes based on style
        switch(entity) {
          case 'urchin':
            renderUrchinSprite(selection, sprite.style, data);
            break;
          case 'harvester':
            renderHarvesterSprite(selection, sprite.style);
            break;
          case 'coral':
            renderCoralSprite(selection, sprite.style, data);
            break;
          case 'algae':
            renderAlgaeSprite(selection, sprite.style, data);
            break;
        }
      }
    };
    
    // Sprite rendering functions
    const renderUrchinSprite = (selection, style, urchins) => {
      selection.each(function(d) {
        const g = d3.select(this);
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
          // More detailed urchin
          const gradient = defs.append('radialGradient')
            .attr('id', `urchin-gradient-${d.id}`)
            .attr('cx', '30%')
            .attr('cy', '30%');
          
          gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#4a4a4a');
          
          gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#1a1a1a');
          
          g.append('circle')
            .attr('r', radius)
            .attr('fill', `url(#urchin-gradient-${d.id})`);
          
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
      });
    };
    
    const renderHarvesterSprite = (selection, style) => {
      selection.each(function(d) {
        const g = d3.select(this);
        
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
      });
    };
    
    const renderCoralSprite = (selection, style, corals) => {
      selection.each(function(d) {
        const g = d3.select(this);
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
      });
    };
    
    const renderAlgaeSprite = (selection, style, corals) => {
      selection.each(function(d) {
        const g = d3.select(this);
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
      });
    };
    
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
    
    // Coral layer
    const coralLayer = svg.append('g').attr('class', 'coral-layer');
    
    const coralGroups = coralLayer.selectAll('.coral-group')
      .data(agents.corals)
      .enter().append('g')
      .attr('class', 'coral-group')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
    
    renderSprite(coralGroups, 'coral', agents.corals);
    
    // Algae layer
    const algaeGroups = coralLayer.selectAll('.algae-group')
      .data(agents.corals.filter(c => c.algaeLevel > 0.1))
      .enter().append('g')
      .attr('class', 'algae-group')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
    
    renderSprite(algaeGroups, 'algae', agents.corals.filter(c => c.algaeLevel > 0.1));
    
    // Sea urchin layer
    const urchinLayer = svg.append('g').attr('class', 'urchin-layer');
    
    const urchinGroups = urchinLayer.selectAll('.urchin-group')
      .data(agents.seaUrchins)
      .enter().append('g')
      .attr('class', 'urchin-group')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
    
    renderSprite(urchinGroups, 'urchin', agents.seaUrchins);
    
    // Harvester layer
    const harvesterLayer = svg.append('g').attr('class', 'harvester-layer');
    
    const harvesterGroups = harvesterLayer.selectAll('.harvester-group')
      .data(agents.harvesters)
      .enter().append('g')
      .attr('class', 'harvester-group')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
    
    renderSprite(harvesterGroups, 'harvester', agents.harvesters);
    
  }, [agents, spriteStyle, customSprites]);

  // Animation loop
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(simulationStep, params.tickRate);
      return () => clearInterval(interval);
    }
  }, [isRunning, simulationStep, params.tickRate]);

  // Initialize on mount
  useEffect(() => {
    initializeSimulation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    
    return <svg ref={chartRef}></svg>;
  };

  // Custom slider component
  const CustomSlider = ({ label, value, onChange, min, max, step, unit, color = 'cyan' }) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const colorMap = {
      cyan: '#00ffcc',
      orange: '#ff7f50',
      pink: '#ff6b8a',
      green: '#00d474',
      purple: '#a855f7'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-teal-500/5"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent animate-gradient">
            Sea Urchin-Coral Reef Ecosystem
          </h1>
          <p className="text-lg text-gray-400 flex items-center justify-center gap-2">
            <Waves className="w-5 h-5" />
            Agent-Based Model for Mactan, Cebu Marine Conservation
          </p>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg rounded-2xl p-4 border border-cyan-500/20 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-300 font-medium">Total Urchins</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.totalUrchins}</p>
              </div>
              <div className="text-3xl">🦔</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/10 backdrop-blur-lg rounded-2xl p-4 border border-pink-500/20 transform hover:scale-105 transition-all">
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
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-lg rounded-2xl p-4 border border-green-500/20 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300 font-medium">Algae Coverage</p>
                <p className="text-2xl font-bold text-green-400">{stats.algaeCoverage.toFixed(0)}%</p>
              </div>
              <div className="text-3xl">🌿</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 backdrop-blur-lg rounded-2xl p-4 border border-orange-500/20 transform hover:scale-105 transition-all">
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
                className="px-4 py-2 bg-gradient-to-r from-slate-700/50 to-slate-600/50 backdrop-blur-lg rounded-full border border-slate-500/30 hover:from-slate-600/50 hover:to-slate-500/50 transition-all flex items-center gap-2 group"
              >
                <span className="text-lg group-hover:scale-125 transition-transform">{preset.icon}</span>
                <span className="text-sm font-medium">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Simulation Controls */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
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
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25' 
                      : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 shadow-lg shadow-cyan-500/25'
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
                  <button
                    onClick={exportData}
                    className="py-2 px-3 rounded-xl font-medium bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-1 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export
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
                  step={params.tickRate <= 10 ? 1 : 10}
                  unit="ms"
                  color="purple"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">Lower = Faster</p>
              </div>

              <div className="mt-4 p-3 bg-slate-900/50 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Simulation Time</span>
                  <span className="font-mono font-bold text-cyan-400">Tick {tick}</span>
                </div>
              </div>
            </div>

            {/* Sea Urchin Parameters */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-cyan-400 flex items-center gap-2">
                <span>🦔</span> Sea Urchin Parameters
              </h3>
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
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-orange-400 flex items-center gap-2">
                <span>🎣</span> Harvester Parameters
              </h3>
              <div className="space-y-4">
                <CustomSlider
                  label="Number of Harvesters"
                  value={params.harvesterCount}
                  onChange={(e) => setParams({...params, harvesterCount: parseInt(e.target.value)})}
                  min={0}
                  max={10}
                  unit=""
                  color="orange"
                />
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
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
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
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
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
            <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
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
                <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-lg rounded-xl p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="font-mono text-yellow-400">{isRunning ? 'Running' : 'Paused'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detailed Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg rounded-xl p-4 border border-cyan-500/20">
                <h4 className="text-xs text-cyan-300 font-medium mb-1">Juvenile Urchins</h4>
                <div className="text-2xl font-bold text-cyan-400">{stats.juvenileUrchins}</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-lg rounded-xl p-4 border border-cyan-500/20">
                <h4 className="text-xs text-cyan-300 font-medium mb-1">Adult Urchins</h4>
                <div className="text-2xl font-bold text-cyan-400">{stats.adultUrchins}</div>
              </div>
              <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/10 backdrop-blur-lg rounded-xl p-4 border border-pink-500/20">
                <h4 className="text-xs text-pink-300 font-medium mb-1">Healthy Corals</h4>
                <div className="text-2xl font-bold text-pink-400">{stats.healthyCorals}</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/20">
                <h4 className="text-xs text-yellow-300 font-medium mb-1">Degraded Corals</h4>
                <div className="text-2xl font-bold text-yellow-400">{stats.degradedCorals}</div>
              </div>
            </div>
            
            {/* Population Chart */}
            <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-400" />
                Population Dynamics
              </h3>
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-2xl max-h-[80vh] overflow-y-auto border border-slate-700/50 shadow-2xl">
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
          box-shadow: 0 2px 10px rgba(0, 255, 204, 0.5);
          transition: all 0.3s ease;
        }
        
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 2px 20px rgba(0, 255, 204, 0.7);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #00ffcc 0%, #00d4aa 100%);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0, 255, 204, 0.5);
          transition: all 0.3s ease;
          border: none;
        }
        
        .slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 2px 20px rgba(0, 255, 204, 0.7);
        }
      `}</style>
    </div>
  );
};

export default SeaUrchinEcosystemModel;