"""
TMR Study Session Manager
Plays TMR cues during study sessions to tag memories for reactivation.
"""
import pygame
import time
import json
import os
from datetime import datetime
from pathlib import Path

class StudySession:
    def __init__(self, config_path="config.json"):
        self.config = self.load_config(config_path)
        self.session_log = []
        pygame.mixer.init()
        
        # Load TMR cue sound
        cue_path = self.config.get("cue_file", "tmr_cue.wav")
        if not os.path.exists(cue_path):
            raise FileNotFoundError(f"TMR cue file not found: {cue_path}. Run sound_generator.py first.")
        
        self.cue_sound = pygame.mixer.Sound(cue_path)
        self.cue_sound.set_volume(self.config.get("study_volume", 0.5))
    
    def load_config(self, config_path):
        """Load configuration from JSON file."""
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def save_session_log(self):
        """Save session log to file."""
        log_file = self.config.get("session_log_file", "study_sessions.json")
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                all_sessions = json.load(f)
        else:
            all_sessions = []
        
        all_sessions.extend(self.session_log)
        
        with open(log_file, 'w') as f:
            json.dump(all_sessions, f, indent=2)
    
    def run_session(self, duration_minutes=None):
        """
        Run a study session with periodic TMR cues.
        
        Args:
            duration_minutes: Session duration in minutes (defaults to config)
        """
        duration = duration_minutes or self.config.get("study_duration_minutes", 25)
        interval = self.config.get("cue_interval_seconds", 60)  # Play cue every minute
        
        session_start = datetime.now()
        print(f"\n{'='*60}")
        print(f"TMR Study Session Started")
        print(f"Duration: {duration} minutes")
        print(f"Cue interval: {interval} seconds")
        print(f"Start time: {session_start.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        start_time = time.time()
        end_time = start_time + (duration * 60)
        cue_count = 0
        
        try:
            while time.time() < end_time:
                # Play TMR cue
                self.cue_sound.play()
                cue_count += 1
                elapsed = int(time.time() - start_time)
                remaining = int(end_time - time.time())
                
                print(f"[{elapsed//60:02d}:{elapsed%60:02d}] Cue #{cue_count} played | {remaining//60:02d}:{remaining%60:02d} remaining")
                
                # Wait for next cue or end of session
                sleep_time = min(interval, remaining)
                if sleep_time > 0:
                    time.sleep(sleep_time)
            
            session_end = datetime.now()
            duration_actual = (session_end - session_start).total_seconds() / 60
            
            # Log session
            session_data = {
                "start": session_start.isoformat(),
                "end": session_end.isoformat(),
                "duration_minutes": duration_actual,
                "cues_played": cue_count,
                "cue_interval_seconds": interval
            }
            self.session_log.append(session_data)
            self.save_session_log()
            
            print(f"\n{'='*60}")
            print(f"Study Session Complete!")
            print(f"Total cues played: {cue_count}")
            print(f"Duration: {duration_actual:.1f} minutes")
            print(f"{'='*60}\n")
            
        except KeyboardInterrupt:
            session_end = datetime.now()
            duration_actual = (session_end - session_start).total_seconds() / 60
            
            session_data = {
                "start": session_start.isoformat(),
                "end": session_end.isoformat(),
                "duration_minutes": duration_actual,
                "cues_played": cue_count,
                "interrupted": True
            }
            self.session_log.append(session_data)
            self.save_session_log()
            
            print(f"\n\nSession interrupted. Cues played: {cue_count}")
            print(f"Duration: {duration_actual:.1f} minutes")

if __name__ == "__main__":
    import sys
    
    duration = None
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            print("Usage: python study_session.py [duration_minutes]")
            sys.exit(1)
    
    session = StudySession()
    session.run_session(duration)
