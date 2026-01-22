# TMR (Targeted Memory Reactivation) System

A Python-based system for optimizing memory consolidation through Targeted Memory Reactivation during study sessions and sleep.

## Overview

This system implements research-backed TMR protocols:
- **Daytime (Study)**: Plays distinctive sound cues during learning to tag memories
- **Nighttime (Sleep)**: Replays those cues during optimal sleep stages (NREM Stage N3) to enhance memory consolidation

## Research Basis

- **Optimal Timing**: Deep sleep (NREM Stage N3) occurs ~60-90 minutes after sleep onset
- **Sleep Latency**: Typical time to fall asleep is ~10-15 minutes
- **Sound Characteristics**: Short (1-2s), unique, neutral sounds at low volume
- **Cue Frequency**: 10-second intervals during deep sleep windows
- **Pink Noise**: Optional background noise that enhances slow-wave activity

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Generate sound files:
```bash
python sound_generator.py
```

This creates:
- `tmr_cue.wav`: The TMR sound cue (1.5s gentle tone)
- `pink_noise.wav`: Optional background noise for sleep

## Usage

### Quick Start

**Option 1: Interactive Manager (Recommended)**
```bash
python tmr_manager.py
```

**Option 2: Direct Scripts**

**Study Session:**
```bash
python study_session.py [duration_minutes]
# Example: python study_session.py 30
```

**Sleep Reactivation:**
```bash
python sleep_reactivation.py
# Or for testing: python sleep_reactivation.py --manual
```

### Typical Workflow

1. **Before Study Session:**
   - Start study session: `python study_session.py 25`
   - Study intensely while cues play periodically
   - Each cue tags the material you're learning

2. **Before Sleep:**
   - Start sleep reactivation: `python sleep_reactivation.py`
   - Script waits 90 minutes (configurable) for deep sleep
   - Then plays cues during optimal sleep windows

### Configuration

Edit `config.json` to customize:

- **Study Settings:**
  - `study_duration_minutes`: Default session length (default: 25)
  - `cue_interval_seconds`: How often cues play during study (default: 60s)
  - `study_volume`: Volume for study cues (0.0-1.0, default: 0.5)

- **Sleep Settings:**
  - `sleep_onset_delay_minutes`: Wait time before reactivation (default: 15, matches 10-15 min sleep latency)
  - `sleep_cue_interval_seconds`: Interval between sleep cues (default: 10s)
  - `sleep_volume`: Volume for sleep cues (default: 0.2 - low to prevent arousal)
  - `use_pink_noise`: Enable pink noise background (default: false)
  - `cues_per_window`: Cues per sleep cycle window (default: 30)

## How It Works

### Study Phase
- Plays TMR cue every 60 seconds during your study session
- Associates the sound with the material you're learning
- Logs session data for tracking

### Sleep Phase
- Waits for sleep onset latency (~10-15 min) before timing cues
- Plays cues during multiple personalized sleep cycle windows (with cushion):
  - Cycle 1 (90 min): 50-85 minutes after sleep onset
  - Cycle 2 (80 min): 110-155 minutes
  - Cycle 3 (75 min): 190-230 minutes
  - Cycle 4 (75 min): 260-300 minutes
- Uses low-volume cues to avoid waking you up

## Best Practices

1. **Consistency**: Use the same sound cue for related study material
2. **Timing**: Start sleep reactivation right before you go to sleep
3. **Volume**: Keep sleep volume low (0.2 or lower) to prevent arousal
4. **Frequency**: Use 1-2 study sessions per day for best results
5. **Material**: Focus on challenging material that needs reinforcement

## Files

- `tmr_manager.py`: Main interactive manager
- `study_session.py`: Study session handler
- `sleep_reactivation.py`: Sleep reactivation scheduler
- `sound_generator.py`: Generates optimal TMR sounds
- `config.json`: Configuration file
- `study_sessions.json`: Study session logs (auto-generated)
- `sleep_sessions.json`: Sleep session logs (auto-generated)

## Troubleshooting

**No sound playing:**
- Check that sound files exist (run `sound_generator.py`)
- Verify pygame is installed correctly
- Check system volume settings

**Sleep script timing issues:**
- Adjust `sleep_onset_delay_minutes` in config.json (set 10-15 minutes if you fall asleep slowly)
- Use `--manual` flag for testing
- Consider your typical sleep latency

**Sound too loud/quiet:**
- Adjust `study_volume` or `sleep_volume` in config.json
- Sleep volume should be low (0.1-0.3) to prevent waking

## References

Based on research in:
- Targeted Memory Reactivation during sleep
- Slow-wave sleep enhancement
- Memory consolidation optimization
