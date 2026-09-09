import concurrent.futures
import json
import pathlib
import subprocess

out=pathlib.Path('/tmp/seerrng-artwork-pr-media')
report=json.loads((out/'assertions.json').read_text())
assert report['success'], report.get('failure')

def encode(record):
    name=record['name']
    mp4=out/f'{name}.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(record['trimStart']),'-i',str(out/'raw'/f'{name}.webm'),'-t',str(record['trimDuration']),'-vf','fps=25,format=yuv420p','-c:v','libx264','-threads','2','-preset','medium','-crf','23','-movflags','+faststart','-an',str(mp4)],check=True)
    width=312 if name.startswith('mobile') else 960
    fps=8 if name.startswith('mobile') else 10
    filter_graph=f'fps={fps},scale={width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(mp4),'-filter_complex',filter_graph,'-threads','2','-loop','0',str(out/f'{name}.gif')],check=True)
    info=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-print_format','json','-show_streams','-show_format',str(mp4)]))
    stream=info['streams'][0]
    return {'file':mp4.name,'bytes':mp4.stat().st_size,'gifBytes':(out/f'{name}.gif').stat().st_size,'width':stream['width'],'height':stream['height'],'codec':stream['codec_name'],'pixelFormat':stream['pix_fmt'],'duration':float(info['format']['duration'])}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    encoded=list(pool.map(encode,report['recordings']))
for name, seconds in [('mobile-all-media',2),('desktop-poster-upgrade',3),('desktop-poster-upgrade',6)]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(seconds),'-i',str(out/f'{name}.mp4'),'-frames:v','1',str(out/'raw'/f'review-frame-{name}-{seconds}s.png')],check=True)
(out/'media-info.json').write_text(json.dumps(encoded,indent=2)+'\n')
print(json.dumps(encoded,indent=2))
