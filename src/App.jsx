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
          v: controls.v,
          m: controls.m,
          h: headlights ? 1 : 0
        });
        const encoder = new TextEncoder();
        bleChar.writeValue(encoder.encode(packet));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [controls, bleChar, connected, headlights]);

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
      <AnimatePresence>
        {isPortrait && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 30 }}
            exit={{ opacity: 0, y: -20 }}
            className="orientation-tip"
          >
            <RefreshCcw size={14} className="spin" /> LANDSCAPE RECOMMENDED
          </motion.div>
        )}
      </AnimatePresence>

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

        <main className="cockpit-view">
          {/* COCKPIT LEFT: Pedals & Auxiliary Controls */}
          <div className="cockpit-left">
            <div className="pedal-section-hud">
              <motion.div className="hud-pedal brake" onPointerDown={handleBrake}>
                <div className="hud-label">STOP</div>
              </motion.div>
              <motion.div className="hud-pedal gas" onPointerDown={handleAccel} onPointerUp={releaseAccel}>
                <div className="hud-label">THRUST</div>
              </motion.div>
            </div>
            
            <div className="action-sidebar" style={{ flexDirection: 'row', gap: '1rem' }}>
              <button className={`side-btn ${headlights ? 'active' : ''}`} onClick={() => setHeadlights(!headlights)}>
                <Lightbulb size={24} />
              </button>
              <button className="side-btn danger" onClick={handleBrake}>
                <Zap size={24} />
              </button>
            </div>
          </div>

          {/* COCKPIT CENTER: Analog Mission Hud */}
          <div className="cockpit-center">
            <div className="chassis-telemetry" style={{ width: '100%', padding: '0' }}>
              <div className="chassis-header">
                <div className={`status-4wd ${connected ? 'active' : ''}`}>
                  LIVE.CHASSIS: {connected ? 'ACTIVE' : 'OFFLINE'}
                </div>
              </div>

              <div className="chassis-body" style={{ height: '220px', margin: '1rem 0' }}>
                <motion.div className="chassis-underglow" animate={{ opacity: controls.v > 0 ? 0.4 : 0.1 }}></motion.div>
                
                {/* Xenon Lighting Systems */}
                <div className={`chassis-led head left ${headlights ? 'on' : ''}`}></div>
                <div className={`chassis-led head right ${headlights ? 'on' : ''}`}></div>
                <div className={`chassis-led tail left ${braking ? 'active' : ''} ${headlights ? 'dim' : ''}`}></div>
                <div className={`chassis-led tail right ${braking ? 'active' : ''} ${headlights ? 'dim' : ''}`}></div>

                {/* 4WD Wheel Loads & Differential Mapping */}
                {(() => {
                  const vel = controls.v;
                  const steer = controls.s;
                  const leftInt = Math.abs(vel + steer) / 100;
                  const rightInt = Math.abs(vel - steer) / 100;
                  return (
                    <>
                      <div className="axle front">
                        <motion.div className={`wheel fl ${vel > 5 ? 'active' : ''}`} animate={{ rotate: rotation/12, scale: 1 + leftInt * 0.1 }}></motion.div>
                        <motion.div className={`wheel fr ${vel > 5 ? 'active' : ''}`} animate={{ rotate: rotation/12, scale: 1 + rightInt * 0.1 }}></motion.div>
                      </div>
                      <div className="axle rear">
                        <motion.div className={`wheel rl ${vel > 5 ? 'active' : ''}`} animate={{ scale: 1 + leftInt * 0.1 }}></motion.div>
                        <motion.div className={`wheel rr ${vel > 5 ? 'active' : ''}`} animate={{ scale: 1 + rightInt * 0.1 }}></motion.div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="central-hud">
              <div className="gauge-ring" style={{ width: '180px', height: '180px' }}>
                <div className="speed-display">
                  <div className="unit">POWER %</div>
                  <div className="val">{controls.v}</div>
                </div>
              </div>
            </div>
          </div>

          {/* COCKPIT RIGHT: Primary Steering Authority */}
          <div className="cockpit-right">
            <div className="steering-section">
              <div
                className="wheel-housing"
                ref={steerArea}
                onMouseDown={onMouseDownSteer}
                onTouchStart={handleSteerStart}
                onTouchMove={handleSteerMove}
                onTouchEnd={stopSteering}
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  width: '380px',
                  height: '380px'
                }}
              >
                <img src={premiumWheel} className="premium-pro-wheel" alt="Steering Wheel" style={{ opacity: 1, filter: 'none' }} />
                <div className="premium-hub" style={{ border: '4px solid #222' }}>DRIVE</div>
              </div>
            </div>
          </div>
        </main>

        <footer style={{ position: 'absolute', bottom: 10, right: 20, opacity: 0.2, fontSize: '0.6rem', letterSpacing: '2px' }}>
          CORE v4.0 PRO | LANDSCAPE OPTIMIZED | HAPTIC ACTIVE
        </footer>
      </div>
    </>
  );
};

export default App;
