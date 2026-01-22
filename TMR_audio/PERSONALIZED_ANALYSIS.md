# Personalized TMR Sleep Analysis

Based on your Apple Watch Sleep Data (Jan 6-21, 2026)

## Sleep Cycle Analysis

### Your Actual Sleep Architecture

**Cycle Duration Pattern:**
- **Cycle 1**: 85-95 minutes (avg: ~90 min) - LONGEST CYCLE
- **Cycle 2**: 75-85 minutes (avg: ~80 min)
- **Cycle 3**: 70-80 minutes (avg: ~75 min)
- **Cycle 4+**: 70-80 minutes (avg: ~75 min)

### Key Findings

1. **First Cycle is Longer**
   - Your first sleep cycle consistently lasts ~85-95 minutes
   - This is 10-20 minutes longer than your later cycles
   - Matches scientific literature showing first cycle is typically longest

2. **Later Cycles Match Your Estimate**
   - Your estimate of 75-85 min cycles is accurate for cycles 2-4
   - These cycles are more consistent in length
   - Cycles gradually get slightly shorter as night progresses

3. **Deep Sleep Distribution**
   - 80-90% of deep sleep occurs in first 2-3 hours
   - First cycle: Heavy deep sleep concentration (dark blue in graphs)
   - Second cycle: Moderate deep sleep
   - Cycles 3+: Minimal to no deep sleep (primarily Core and REM)
   - Overall deep sleep percentage: 10-17% (healthy range)

4. **Sleep Stage Progression**
   - Early night: Deep → Core → REM pattern
   - Late night: Core ↔ REM cycling with minimal deep sleep
   - Awakenings: Brief, scattered throughout (1-6% total)

## Optimal TMR Schedule (Personalized)

### Window Timing

**Cycle 1: 50-85 minutes after sleep onset**
- Target: Peak deep sleep period
- Duration: 35-minute window (cushioned)
- Cycle length: ~90 minutes
- Deep sleep probability: **HIGH**
- Priority: **CRITICAL** - Most effective window

**Cycle 2: 110-155 minutes**
- Target: Moderate deep sleep period
- Duration: 45-minute window (cushioned)
- Cycle length: ~80 minutes
- Deep sleep probability: **MODERATE**
- Priority: **HIGH** - Still beneficial

**Cycle 3: 190-230 minutes**
- Target: Light sleep period
- Duration: 40-minute window (cushioned)
- Cycle length: ~75 minutes
- Deep sleep probability: **LOW**
- Priority: **MEDIUM** - Maintenance reinforcement

**Cycle 4: 260-300 minutes**
- Target: Very light sleep period
- Duration: 40-minute window (cushioned)
- Cycle length: ~75 minutes
- Deep sleep probability: **MINIMAL**
- Priority: **LOW** - Optional reinforcement

## Implementation Recommendations

### Timing Strategy

1. **Start Script When Getting Into Bed**
   - Typical sleep latency is ~10-15 minutes
   - System automatically targets your sleep cycles
   - First cues play ~50-85 minutes after sleep onset

2. **Priority Windows**
   - If limited time: Focus on Cycles 1 & 2 (first 3 hours)
   - For full session: All 4 cycles (5 hours total)
   - Most benefit comes from first 2 cycles

3. **Cue Frequency**
   - Cycle 1: Every 10 seconds (peak consolidation)
   - Cycle 2: Every 10-15 seconds
   - Cycle 3-4: Every 15-20 seconds (lighter sleep)

### Sleep Optimization Tips

Based on your data patterns:

1. **Consistency**: Your deep sleep percentage (10-17%) is excellent
2. **First 3 Hours Critical**: Protect this time window - it's when most memory consolidation occurs
3. **Cycle Length Variability**: Your cycles are quite consistent, making TMR timing more predictable
4. **Awakenings**: Your brief awakenings (1-6%) are normal and don't disrupt the process

## Configuration Changes Made

### Python Scripts (`TMR_audio/`)
- Updated `sleep_reactivation.py` with personalized cycle timing
- Set default sleep onset delay to 15 min (matches 10-15 min latency)
- Updated window calculations to match your cycles
- Added cycle descriptions based on your data

### Web App (`sfjc.dev/games/tmr`)
- Updated `src/lib/tmr.ts` with personalized calculateSleepWindows()
- Modified sleep reactivation UI to show your specific cycles
- Added sleep latency note (10-15 min)

### Configuration Files
- Updated `personalized_config.json` with your cycle data
- Updated default `config.json` to use 15 min sleep onset delay

## Usage Instructions

### For Best Results:

1. **Study Session (20-30 min)**
   - Use normal study session settings
   - No changes needed here

2. **Sleep Reactivation**
   - Start script when you get into bed
   - Put on sleep headband
   - Run: `python3 sleep_reactivation.py`
   - Script will automatically wait for your optimal windows

3. **Volume Settings**
   - Keep sleep volume LOW (15-25%)
   - You should barely hear the cues consciously
   - If waking up, reduce volume further

## Data Sources

Analysis based on 11 nights of Apple Watch sleep data:
- Jan 21, 20, 19, 14, 13, 12, 10, 9, 8, 7, 6, 2026
- Total sleep time: 7-8 hours per night
- Consistent sleep architecture across all nights
- Clear cycle patterns visible in stage transitions
