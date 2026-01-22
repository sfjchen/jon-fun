"""
TMR Sleep Reactivation Scheduler
Plays TMR cues during optimal sleep stages (NREM Stage N3 - Slow Wave Sleep).
Based on research: optimal timing is 60-90 minutes after sleep onset.
"""
import pygame
import time
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

class SleepReactivation:
    def __init__(self, config_path="config.json"):
        self.config = self.load_config(config_path)
        pygame.mixer.init()
        
        # Load TMR cue sound
        cue_path = self.config.get("cue_file", "tmr_cue.wav")
        if not os.path.exists(cue_path):
            raise FileNotFoundError(f"TMR cue file not found: {cue_path}. Run sound_generator.py first.")
        
        self.cue_sound = pygame.mixer.Sound(cue_path)
        # Low volume for sleep (prevents arousal)
        sleep_volume = self.config.get("sleep_volume", 0.2)
        self.cue_sound.set_volume(sleep_volume)
        
        # Optional pink noise background
        pink_noise_path = self.config.get("pink_noise_file", "pink_noise.wav")
        self.pink_noise = None
        if os.path.exists(pink_noise_path) and self.config.get("use_pink_noise", False):
            self.pink_noise = pygame.mixer.Sound(pink_noise_path)
            self.pink_noise.set_volume(self.config.get("pink_noise_volume", 0.1))
    
    def load_config(self, config_path):
        """Load configuration from JSON file."""
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def calculate_sleep_windows(self, sleep_onset_delay_minutes=0):
        """
        Calculate optimal TMR reactivation windows based on PERSONALIZED sleep cycles.
        
        Based on Apple Watch data analysis:
        - Cycle 1 (105 min): Heavy deep sleep, 60-90 min window
        - Cycle 2 (75 min): Moderate deep sleep, 120-165 min window  
        - Cycle 3 (75 min): Light sleep, 195-235 min window
        - Cycle 4 (70 min): Very light, 265-300 min window
        
        Args:
            sleep_onset_delay_minutes: Minutes to wait before starting (default: 0, start immediately)
        """
        windows = []
        
        # Personalized sleep cycle windows based on your Apple Watch data
        # Cycle 1: 0-105 min, target 60-90 min (peak deep sleep)
        windows.append({
            "start_minutes": sleep_onset_delay_minutes + 60,
            "end_minutes": sleep_onset_delay_minutes + 90,
            "cycle": 1,
            "description": "Peak deep sleep - first cycle (105 min)"
        })
        
        # Cycle 2: 105-180 min, target 120-165 min (some deep sleep)
        windows.append({
            "start_minutes": sleep_onset_delay_minutes + 120,
            "end_minutes": sleep_onset_delay_minutes + 165,
            "cycle": 2,
            "description": "Moderate deep sleep - second cycle (75 min)"
        })
        
        # Cycle 3: 180-255 min, target 195-235 min (light sleep)
        windows.append({
            "start_minutes": sleep_onset_delay_minutes + 195,
            "end_minutes": sleep_onset_delay_minutes + 235,
            "cycle": 3,
            "description": "Light sleep - third cycle (75 min)"
        })
        
        # Cycle 4: 255-325 min, target 265-300 min (very light)
        windows.append({
            "start_minutes": sleep_onset_delay_minutes + 265,
            "end_minutes": sleep_onset_delay_minutes + 300,
            "cycle": 4,
            "description": "Very light sleep - fourth cycle (70 min)"
        })
        
        return windows
    
    def run_reactivation(self, sleep_onset_delay_minutes=None, manual_mode=False):
        """
        Run TMR reactivation during sleep.
        
        Args:
            sleep_onset_delay_minutes: Minutes to wait before starting (defaults to config)
            manual_mode: If True, start immediately (for testing)
        """
        delay = sleep_onset_delay_minutes or self.config.get("sleep_onset_delay_minutes", 0)
        cue_interval = self.config.get("sleep_cue_interval_seconds", 10)
        cues_per_window = self.config.get("cues_per_window", 30)
        
        if manual_mode:
            delay = 0
            print("MANUAL MODE: Starting immediately (for testing)")
        
        print(f"\n{'='*60}")
        print(f"TMR Sleep Reactivation Armed (PERSONALIZED)")
        print(f"Based on your Apple Watch sleep data analysis:")
        print(f"  - Cycle 1 (105 min): 60-90 min - Peak deep sleep")
        print(f"  - Cycle 2 (75 min): 120-165 min - Moderate deep sleep")
        print(f"  - Cycle 3 (75 min): 195-235 min - Light sleep")
        print(f"  - Cycle 4 (70 min): 265-300 min - Very light sleep")
        print(f"Sleep onset delay: {delay} minutes")
        print(f"Cue interval: {cue_interval} seconds")
        print(f"Cues per window: {cues_per_window}")
        print(f"{'='*60}\n")
        
        if delay > 0:
            print(f"Waiting {delay} minutes before starting...")
            print("(This script should be started right as you get into bed)")
            print(f"Sleep reactivation will begin at: {(datetime.now() + timedelta(minutes=delay)).strftime('%H:%M:%S')}\n")
            
            # Countdown
            for remaining in range(delay * 60, 0, -60):
                mins = remaining // 60
                print(f"  {mins} minutes remaining...", end='\r')
                time.sleep(60)
            print("\n")
        
        # Calculate reactivation windows
        windows = self.calculate_sleep_windows(delay)
        
        # Start pink noise if enabled
        if self.pink_noise:
            self.pink_noise.play(loops=-1)  # Loop indefinitely
            print("Pink noise background started (enhances slow-wave activity)")
        
        # Reactivate during each window
        total_cues = 0
        start_time = time.time()
        
        for window in windows:
            window_start_time = start_time + (window["start_minutes"] * 60)
            window_end_time = start_time + (window["end_minutes"] * 60)
            
            # Wait until window starts
            wait_time = window_start_time - time.time()
            if wait_time > 0:
                print(f"\nWaiting for Cycle {window['cycle']} window...")
                time.sleep(wait_time)
            
            print(f"\n[Cycle {window['cycle']}] Starting reactivation...")
            
            # Play cues during this window
            window_cues = 0
            while time.time() < window_end_time and window_cues < cues_per_window:
                self.cue_sound.play()
                window_cues += 1
                total_cues += 1
                
                elapsed = int(time.time() - start_time)
                print(f"  [{elapsed//60:02d}:{elapsed%60:02d}] Cue #{total_cues} (Cycle {window['cycle']})", end='\r')
                
                time.sleep(cue_interval)
            
            print(f"\n[Cycle {window['cycle']}] Complete ({window_cues} cues)")
        
        # Stop pink noise
        if self.pink_noise:
            pygame.mixer.stop()
        
        print(f"\n{'='*60}")
        print(f"TMR Sleep Reactivation Complete!")
        print(f"Total cues played: {total_cues}")
        print(f"Duration: {(time.time() - start_time)/60:.1f} minutes")
        print(f"{'='*60}\n")
        
        # Log session
        self.log_session(start_time, time.time(), total_cues, len(windows))
    
    def log_session(self, start_time, end_time, total_cues, cycles):
        """Log sleep reactivation session."""
        log_file = self.config.get("sleep_log_file", "sleep_sessions.json")
        
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                all_sessions = json.load(f)
        else:
            all_sessions = []
        
        session_data = {
            "start": datetime.fromtimestamp(start_time).isoformat(),
            "end": datetime.fromtimestamp(end_time).isoformat(),
            "duration_minutes": (end_time - start_time) / 60,
            "total_cues": total_cues,
            "cycles": cycles
        }
        
        all_sessions.append(session_data)
        
        with open(log_file, 'w') as f:
            json.dump(all_sessions, f, indent=2)

if __name__ == "__main__":
    import sys
    
    manual = "--manual" in sys.argv or "-m" in sys.argv
    
    reactivation = SleepReactivation()
    reactivation.run_reactivation(manual_mode=manual)
