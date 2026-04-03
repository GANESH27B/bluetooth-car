import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Lightbulb, Bell, Zap, RefreshCcw } from 'lucide-react';
import './App.css';
import premiumWheel from './assets/pro_wheel-removebg-preview.png';

const App = () => {
  // State
  const [showSettings, setShowSettings] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bleDevice, setBleDevice] = useState(null);
  const [bleChar, setBleChar] = useState(null);
  const [gear, setGear] = useState('D');
  const [controls, setControls] = useState({ s: 0, v: 0, m: 255 });
  const [headlights, setHeadlights] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [gamepadActive, setGamepadActive] = useState(false);
  const [braking, setBraking] = useState(false);
  const [orientation, setOrientation] = useState(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');

  // Refs
  const ws = useRef(null);
  const steerArea = useRef(null);
  const accelTimer = useRef(null);
  const lastSteerAngle = useRef(0);
  const [rotation, setRotation] = useState(0); // For visual wheel rotation

  // Connection Handler
  // Bluetooth BLE Handler
  const connect = async () => {
    setLoading(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'CyberRacer' }],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      const char = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');
      
      setBleDevice(device);
      setBleChar(char);
      setConnected(true);
      hapticFeedback(100);
      device.ongattserverdisconnected = () => setConnected(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkOrientation = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    window.addEventListener('resize', checkOrientation);
    return () => {
      bleDevice?.gatt.disconnect();
      window.removeEventListener('resize', checkOrientation);
    };
  }, [bleDevice]);

  // Control Sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (connected && bleChar) {
        const packet = JSON.stringify({
          s: controls.s,
          v: gear === 'R' ? -controls.v : controls.v,
          m: controls.m,
          h: headlights ? 1 : 0
        });
        const encoder = new TextEncoder();
        bleChar.writeValue(encoder.encode(packet));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [controls, gear, bleChar, connected, headlights]);

  // Haptic Feedback Engine
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gamepad Controller Engine
  useEffect(() => {
    let gpLoop;
    const updateGamepad = () => {
      const gpts = navigator.getGamepads();
      const gp = gpts[0];
      if (gp) {
        setGamepadActive(true);
        // Steering: Axis 0 (Left Stick X)
        const sVal = Math.round(gp.axes[0] * 100);
        // Acceleration: RT (Trigger) or Axis 5, Brake: LT or Axis 2
        const accel = gp.buttons[7]?.value || 0;
        const brake = gp.buttons[6]?.value || 0;
        
        setControls(prev => ({
          ...prev,
          s: Math.abs(sVal) > 5 ? sVal : 0,
          v: accel > 0.05 ? Math.round(accel * 100) : (brake > 0.05 ? 0 : prev.v)
        }));
        if (brake > 0.5) setControls(prev => ({ ...prev, v: 0 }));
      } else {
        setGamepadActive(false);
      }
      gpLoop = requestAnimationFrame(updateGamepad);
    };
    gpLoop = requestAnimationFrame(updateGamepad);
    return () => cancelAnimationFrame(gpLoop);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const hapticFeedback = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  // Professional Multi-Turn Steering with Liquid-Smooth Physics
  const isDragging = useRef(false);
  const animFrame = useRef(null);

  const springBack = () => {
    if (isDragging.current) return;
    setRotation(prev => {
      const tension = 0.14; // Premium, liquid-smooth return
      const nextRot = prev * (1 - tension);
      if (Math.abs(nextRot) < 0.1) {
        setControls(c => ({ ...c, s: 0 }));
        return 0;
      }
      setControls(c => ({ ...c, s: Math.round(nextRot / 7.2) }));
      animFrame.current = requestAnimationFrame(springBack);
      return nextRot;
    });
  };

  const handleSteerStart = (e) => {
    isDragging.current = true;
    cancelAnimationFrame(animFrame.current);
    const touch = e.touches ? e.touches[0] : e;
    const rect = steerArea.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    lastSteerAngle.current = Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI);
  };

  const handleSteerMove = (e) => {
    if (!isDragging.current) return;
    const touch = e.touches ? e.touches[0] : e;
    const rect = steerArea.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI);

    let delta = currentAngle - lastSteerAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const limit = 540;
    lastSteerAngle.current = currentAngle;

    setRotation(prev => {
      const nextRot = Math.min(limit, Math.max(-limit, prev + delta));
      setControls(c => ({ ...c, s: Math.round(nextRot / (limit / 100)) }));
      if (Math.abs(nextRot) >= limit) hapticFeedback(5);
      return nextRot;
    });
  };

  const stopSteering = () => {
    isDragging.current = false;
    animFrame.current = requestAnimationFrame(springBack);
  };

  // Mouse Support
  const onMouseDownSteer = (e) => {
    handleSteerStart(e);
    const move = (me) => handleSteerMove(me);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      stopSteering();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Acceleration Logic
  const handleAccel = () => {
    hapticFeedback(20);
    if (accelTimer.current) clearInterval(accelTimer.current);
    accelTimer.current = setInterval(() => {
      setControls(prev => ({ ...prev, v: Math.min(100, prev.v + 8) }));
    }, 60);
  };

  const releaseAccel = () => {
    if (accelTimer.current) clearInterval(accelTimer.current);
    accelTimer.current = setInterval(() => {
      setControls(prev => {
        const nextV = Math.max(0, prev.v - 12);
        if (nextV <= 0) clearInterval(accelTimer.current);
        return { ...prev, v: nextV };
      });
    }, 60);
  };

  const handleBrake = () => {
    hapticFeedback(40);
    setBraking(true);
    if (accelTimer.current) clearInterval(accelTimer.current);
    setControls(prev => ({ ...prev, v: 0 }));
    setTimeout(() => setBraking(false), 800);
  };

  return (
    <>
      <div className="portrait-lock">
        <Zap size={48} color="#00ffcc" />
        <h2 style={{ marginTop: '1rem', fontFamily: 'Orbitron' }}>ULTIMA ORIENTATION REQUIRED</h2>
        <p style={{ opacity: 0.5, marginTop: '0.5rem' }}>Rotate your device to landscape for full control.</p>
        <RefreshCcw size={24} style={{ marginTop: '2rem', animation: 'spin 2s linear infinite' }} />
      </div>

      <div className="ultima-container">
        <header className="header-bar">
          <div className="logo-section">
            <h1>CYBER<span>ULTIMA</span></h1>
          </div>
          <div className="header-actions">
            <div className={`connection-pill ${connected ? 'online' : ''}`} onClick={connect}>
              <div className={`pulse-dot ${connected ? 'online' : ''}`}></div>
              {connected ? 'BLE LINK ACTIVE' : 'TAP TO SCAN (BLE)'}
            </div>
            <div className={`gp-status ${gamepadActive ? 'active' : ''}`}>
              <Zap size={14} /> {gamepadActive ? 'REMOTE LINKED' : 'NO REMOTE'}
            </div>
            <button className="fs-toggle" onClick={toggleFullscreen}>
              {fullscreen ? 'EXIT' : 'FULLSCREEN'}
            </button>
          </div>
        </header>

        <section className="instrument-cluster">
          <div className="steering-section">
            <div
              className="wheel-housing"
              ref={steerArea}
              onMouseDown={onMouseDownSteer}
              onTouchStart={handleSteerStart}
              onTouchMove={handleSteerMove}
              onTouchEnd={stopSteering}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <img src={premiumWheel} className="premium-pro-wheel" alt="Steering Wheel" />
              <div className="premium-hub">CYBER</div>
            </div>
          </div>

          {/* Professional 4WD Chassis & Telemetry Hub */}
          <div className="chassis-telemetry">
            <div className="chassis-header">
              <div className={`status-4wd ${connected ? 'active' : ''}`}>
                <Zap size={12} /> {gear === 'D' ? '4WD DRIVE' : 'REVERSE ENGAGED'}
              </div>
              <div className="gear-toggle" onClick={() => { setGear(g => g === 'D' ? 'R' : 'D'); hapticFeedback(30); }}>
                <span className={gear === 'D' ? 'active' : ''}>D</span>
                <span className={gear === 'R' ? 'active' : ''}>R</span>
              </div>
            </div>

            <div className="chassis-body">
              {/* Ground Underglow Lighting */}
              <motion.div 
                className="chassis-underglow"
                animate={{ 
                  scale: controls.v > 0 ? [1, 1.2, 1] : 1,
                  opacity: controls.v > 0 ? 0.3 : (braking ? 0.6 : 0.1),
                  background: braking ? 'rgba(255, 40, 0, 0.4)' : (gear === 'R' ? 'rgba(255, 60, 0, 0.4)' : 'rgba(0, 255, 204, 0.4)')
                }}
                transition={{ repeat: Infinity, duration: 1 }}
              ></motion.div>

              {/* Intelligent Lighting System */}
              <motion.div 
                className={`chassis-led head left ${headlights ? 'on' : ''}`}
                animate={{ scale: headlights ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 2 }}
              ></motion.div>
              <motion.div 
                className={`chassis-led head right ${headlights ? 'on' : ''}`}
                animate={{ scale: headlights ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 2 }}
              ></motion.div>
              
              <motion.div 
                className={`chassis-led tail left ${braking ? 'active' : ''} ${headlights ? 'dim' : ''}`}
                animate={{ scale: braking ? 1.4 : 1 }}
              ></motion.div>
              <motion.div 
                className={`chassis-led tail right ${braking ? 'active' : ''} ${headlights ? 'dim' : ''}`}
                animate={{ scale: braking ? 1.4 : 1 }}
              ></motion.div>
              
              {/* Beaming Headlight Rays */}
              <AnimatePresence>
                {headlights && (
                  <motion.div 
                    className="light-beams"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                  >
                    <div className="beam left"></div>
                    <div className="beam right"></div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Wheel calculations based on differential drive formula (v+s, v-s) */}
              {(() => {
                const vel = controls.v;
                const steer = controls.s;
                const leftInt = Math.abs(vel + steer) / 100;
                const rightInt = Math.abs(vel - steer) / 100;
                
                return (
                  <>
                    <div className="axle front">
                      <motion.div 
                        className={`wheel fl ${vel > 0 || Math.abs(steer) > 5 ? 'active' : ''}`} 
                        animate={{ rotate: rotation/12, scale: 1 + leftInt * 0.1 }}
                        style={{ borderColor: gear === 'R' ? 'var(--accent-warn)' : 'var(--accent-neon)' }}
                      >
                        {leftInt > 0.1 && <div className="motor-pulse"></div>}
                      </motion.div>
                      <motion.div 
                        className={`wheel fr ${vel > 0 || Math.abs(steer) > 5 ? 'active' : ''}`} 
                        animate={{ rotate: rotation/12, scale: 1 + rightInt * 0.1 }}
                        style={{ borderColor: gear === 'R' ? 'var(--accent-warn)' : 'var(--accent-neon)' }}
                      >
                        {rightInt > 0.1 && <div className="motor-pulse"></div>}
                      </motion.div>
                    </div>
                    <div className="axle rear">
                      <motion.div 
                        className={`wheel rl ${vel > 0 || Math.abs(steer) > 5 ? 'active' : ''}`} 
                        animate={{ scale: 1 + leftInt * 0.1 }}
                        style={{ borderColor: gear === 'R' ? 'var(--accent-warn)' : 'var(--accent-neon)' }}
                      >
                        {leftInt > 0.1 && <div className="motor-pulse"></div>}
                      </motion.div>
                      <motion.div 
                        className={`wheel rr ${vel > 0 || Math.abs(steer) > 5 ? 'active' : ''}`} 
                        animate={{ scale: 1 + rightInt * 0.1 }}
                        style={{ borderColor: gear === 'R' ? 'var(--accent-warn)' : 'var(--accent-neon)' }}
                      >
                        {rightInt > 0.1 && <div className="motor-pulse"></div>}
                      </motion.div>
                    </div>
                  </>
                );
              })()}
              <div className="chassis-glow" style={{ background: gear === 'R' ? 'radial-gradient(circle, rgba(255, 60, 0, 0.2) 0%, transparent 70%)' : '' }}></div>
            </div>
            
            <div className="telemetry-data">
              <div className="data-node">
                <label>LOAD L</label>
                <span>{Math.round(Math.abs(controls.v + controls.s))}%</span>
              </div>
              <div className="data-node">
                <label>LOAD R</label>
                <span>{Math.round(Math.abs(controls.v - controls.s))}%</span>
              </div>
            </div>
          </div>

          <div className="central-hud">
            <div className="gauge-ring">
              <div className="gauge-needle" style={{ transform: `rotate(${(controls.v * 1.8) - 90}deg)` }}></div>
              <div className="speed-display">
                <div className="val">{controls.v}</div>
                <div className="unit">Engine Load %</div>
                
                {/* Advanced Gear HUD Animation */}
                <div className="gear-hud-container">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={gear}
                      initial={{ y: 20, opacity: 0, scale: 0.5 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -20, opacity: 0, scale: 0.5 }}
                      className={`gear-hud-label ${gear === 'D' ? 'drive' : 'reverse'}`}
                    >
                      {gear}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <div className="gear-shifter" style={{ marginTop: '1rem' }} onClick={() => { setGear(g => g === 'D' ? 'R' : 'D'); hapticFeedback(30); }}>
              <label>TRANSMISSION</label>
              <h2 style={{ color: gear === 'D' ? '#00ffcc' : '#ff3c00' }}>{gear === 'D' ? 'DRIVE' : 'REVERSE'}</h2>
            </div>
          </div>

          {/* Pedal Section (Pro HUD Style) */}
          <div className="pedal-section-hud">
            <motion.div
              className="hud-pedal brake"
              onPointerDown={handleBrake}
              whileTap={{ scale: 0.98 }}
            >
              <div className="hud-label">BRAKE</div>
              <div className="hud-gauge">
                <div className="gauge-track"></div>
                <div className="gauge-fill-red" style={{ height: controls.v === 0 && !isDragging.current ? '100%' : '0%' }}></div>
              </div>
              <div className="hud-status">{controls.v === 0 && !isDragging.current ? 'ACTIVE' : 'IDLE'}</div>
            </motion.div>

            <motion.div
              className="hud-pedal gas"
              onPointerDown={handleAccel}
              onPointerUp={releaseAccel}
              onPointerLeave={releaseAccel}
              whileTap={{ scale: 0.98 }}
            >
              <div className="hud-label">THRUST</div>
              <div className="hud-gauge">
                <div className="gauge-track"></div>
                <div className="gauge-fill-cyan" style={{ height: `${controls.v}%` }}></div>
              </div>
              <div className="hud-status">{controls.v}%</div>
            </motion.div>

            <div className="action-sidebar">
              <button className={`side-btn ${headlights ? 'active' : ''}`} onClick={() => { setHeadlights(!headlights); hapticFeedback(20); }}>
                <Lightbulb size={24} />
              </button>
              <button className="side-btn danger" onClick={handleBrake}>
                <Power size={24} />
              </button>
            </div>
          </div>
        </section>

        <footer style={{ position: 'absolute', bottom: 10, right: 20, opacity: 0.2, fontSize: '0.6rem', letterSpacing: '2px' }}>
          CORE v4.0 PRO | LANDSCAPE OPTIMIZED | HAPTIC ACTIVE
        </footer>
      </div>
    </>
  );
};

export default App;
