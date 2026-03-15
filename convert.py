import imageio
import sys
import numpy as np

input_file = r"C:\Users\enosh\.gemini\antigravity\brain\8fe0a191-e034-4a84-bf29-78c3f1b4bf9e\clear_dashboard_recording_1773576663981.webp"
output_file = r"c:\Users\enosh\Desktop\LLM_PROJECT\dashboard_recording.mp4"

print(f"Reading {input_file}...")
try:
    reader = imageio.get_reader(input_file)
    fps = reader.get_meta_data().get('fps', 10)
    
    print(f"Writing {output_file} at {fps} fps...")
    writer = imageio.get_writer(output_file, fps=fps, macro_block_size=None)
    
    for i, frame in enumerate(reader):
        # Convert to numpy array just in case
        frame = np.array(frame)
        
        # H264 requires width and height to be divisible by 2
        if frame.shape[0] % 2 != 0:
            frame = frame[:-1, :, :]
        if frame.shape[1] % 2 != 0:
            frame = frame[:, :-1, :]
            
        writer.append_data(frame)
        if i % 50 == 0:
            print(f"Processed {i} frames...")
            
    writer.close()
    print("Conversion complete!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
