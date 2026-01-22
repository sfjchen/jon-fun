"""
TMR Manager - Main coordinator for Targeted Memory Reactivation system.
Provides a unified interface for study sessions and sleep reactivation.
"""
import json
import os
import sys
from datetime import datetime
from study_session import StudySession
from sleep_reactivation import SleepReactivation

class TMRManager:
    def __init__(self, config_path="config.json"):
        self.config_path = config_path
        self.config = self.load_config()
        
    def load_config(self):
        """Load configuration."""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def show_menu(self):
        """Display main menu."""
        print("\n" + "="*60)
        print("TMR (Targeted Memory Reactivation) Manager")
        print("="*60)
        print("1. Start Study Session")
        print("2. Schedule Sleep Reactivation")
        print("3. View Session History")
        print("4. Generate/Regenerate Sound Files")
        print("5. Configure Settings")
        print("0. Exit")
        print("="*60)
    
    def start_study_session(self):
        """Start a study session."""
        print("\nStarting Study Session...")
        try:
            duration = input("Session duration in minutes (default: 25): ").strip()
            duration = int(duration) if duration else None
            
            session = StudySession(self.config_path)
            session.run_session(duration)
        except Exception as e:
            print(f"Error: {e}")
    
    def schedule_sleep_reactivation(self):
        """Schedule sleep reactivation."""
        print("\nScheduling Sleep Reactivation...")
        print("This should be started right before you go to sleep.")
        
        confirm = input("Are you ready to sleep? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Sleep reactivation cancelled.")
            return
        
        try:
            default_delay = self.config.get("sleep_onset_delay_minutes", 0)
            delay_input = input(f"Minutes until sleep onset (default: {default_delay}): ").strip()
            delay = int(delay_input) if delay_input else default_delay
            
            reactivation = SleepReactivation(self.config_path)
            reactivation.run_reactivation(sleep_onset_delay_minutes=delay)
        except Exception as e:
            print(f"Error: {e}")
    
    def view_history(self):
        """View session history."""
        study_log = self.config.get("session_log_file", "study_sessions.json")
        sleep_log = self.config.get("sleep_log_file", "sleep_sessions.json")
        
        print("\n" + "="*60)
        print("Session History")
        print("="*60)
        
        # Study sessions
        if os.path.exists(study_log):
            with open(study_log, 'r') as f:
                study_sessions = json.load(f)
            
            print(f"\nStudy Sessions ({len(study_sessions)} total):")
            for i, session in enumerate(study_sessions[-10:], 1):  # Last 10
                start = datetime.fromisoformat(session['start'])
                duration = session.get('duration_minutes', 0)
                cues = session.get('cues_played', 0)
                print(f"  {i}. {start.strftime('%Y-%m-%d %H:%M')} | {duration:.1f} min | {cues} cues")
        else:
            print("\nNo study sessions logged yet.")
        
        # Sleep sessions
        if os.path.exists(sleep_log):
            with open(sleep_log, 'r') as f:
                sleep_sessions = json.load(f)
            
            print(f"\nSleep Reactivation Sessions ({len(sleep_sessions)} total):")
            for i, session in enumerate(sleep_sessions[-10:], 1):  # Last 10
                start = datetime.fromisoformat(session['start'])
                duration = session.get('duration_minutes', 0)
                cues = session.get('total_cues', 0)
                cycles = session.get('cycles', 0)
                print(f"  {i}. {start.strftime('%Y-%m-%d %H:%M')} | {duration:.1f} min | {cues} cues | {cycles} cycles")
        else:
            print("\nNo sleep reactivation sessions logged yet.")
        
        print("="*60 + "\n")
    
    def generate_sounds(self):
        """Generate TMR sound files."""
        print("\nGenerating TMR sound files...")
        try:
            from sound_generator import generate_tmr_cue, generate_pink_noise
            
            generate_tmr_cue("tmr_cue.wav")
            generate_pink_noise("pink_noise.wav", duration=300)
            
            print("\nSound files generated successfully!")
        except Exception as e:
            print(f"Error generating sounds: {e}")
            print("Make sure numpy and soundfile are installed: pip install numpy soundfile")
    
    def configure_settings(self):
        """Configure TMR settings."""
        print("\nCurrent Configuration:")
        print(json.dumps(self.config, indent=2))
        
        print("\nTo modify settings, edit config.json directly.")
        print("Key settings:")
        print("  - study_duration_minutes: Default study session length")
        print("  - cue_interval_seconds: How often to play cues during study")
        print("  - sleep_onset_delay_minutes: Minutes to wait before sleep reactivation")
        print("  - sleep_cue_interval_seconds: Interval between sleep cues")
        print("  - sleep_volume: Volume for sleep cues (0.0-1.0, lower is better)")
        print("  - use_pink_noise: Enable pink noise background during sleep")
    
    def run(self):
        """Run main loop."""
        while True:
            self.show_menu()
            choice = input("\nSelect option: ").strip()
            
            if choice == "1":
                self.start_study_session()
            elif choice == "2":
                self.schedule_sleep_reactivation()
            elif choice == "3":
                self.view_history()
            elif choice == "4":
                self.generate_sounds()
            elif choice == "5":
                self.configure_settings()
            elif choice == "0":
                print("\nGoodbye!")
                break
            else:
                print("Invalid option. Please try again.")

if __name__ == "__main__":
    manager = TMRManager()
    manager.run()
