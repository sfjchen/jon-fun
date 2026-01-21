"""
Generate optimal TMR sound cues based on research.
TMR cues should be: unique, neutral, short (1-2s), and low-intensity for sleep.
"""
import numpy as np
import soundfile as sf
import os

def generate_tmr_cue(output_path="tmr_cue.wav", duration=1.5, frequency=440, sample_rate=44100):
    """
    Generate a gentle, neutral TMR cue sound.
    
    Uses a soft sine wave with fade in/out to prevent sleep disruption.
    Frequency: 440Hz (A4) - neutral and pleasant.
    """
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Generate sine wave
    wave = np.sin(2 * np.pi * frequency * t)
    
    # Apply fade in/out envelope (prevents jarring sounds)
    fade_samples = int(0.1 * sample_rate)  # 100ms fade
    envelope = np.ones_like(wave)
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    
    wave = wave * envelope
    
    # Normalize to prevent clipping
    wave = wave * 0.5
    
    # Save as WAV file
    sf.write(output_path, wave, sample_rate)
    print(f"Generated TMR cue: {output_path}")
    return output_path

def generate_pink_noise(output_path="pink_noise.wav", duration=300, sample_rate=44100):
    """
    Generate pink noise for background during sleep.
    Pink noise enhances slow-wave activity and can improve TMR effectiveness.
    """
    # Generate white noise
    white_noise = np.random.randn(int(sample_rate * duration))
    
    # Apply pink noise filter (1/f filter)
    # Simplified pink noise generation
    fft = np.fft.rfft(white_noise)
    frequencies = np.fft.rfftfreq(len(white_noise), 1/sample_rate)
    # Avoid division by zero
    frequencies[0] = 1
    pink_filter = 1 / np.sqrt(frequencies)
    pink_filter[0] = 0
    pink_fft = fft * pink_filter
    pink_noise = np.fft.irfft(pink_fft, len(white_noise))
    
    # Normalize
    pink_noise = pink_noise / np.max(np.abs(pink_noise)) * 0.3  # Low volume
    
    # Apply fade in/out
    fade_samples = int(2 * sample_rate)  # 2 second fade
    envelope = np.ones_like(pink_noise)
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    pink_noise = pink_noise * envelope
    
    sf.write(output_path, pink_noise, sample_rate)
    print(f"Generated pink noise: {output_path}")
    return output_path

if __name__ == "__main__":
    # Generate default sounds
    generate_tmr_cue("tmr_cue.wav")
    generate_pink_noise("pink_noise.wav", duration=300)  # 5 minutes
    print("\nSound files generated successfully!")
    print("Use tmr_cue.wav for study sessions and sleep reactivation.")
