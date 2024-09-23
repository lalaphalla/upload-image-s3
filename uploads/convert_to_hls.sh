#!/bin/bash
# Script to convert input.mp4 to HLS with 360p and 480p streams

# ffmpeg -i Deque-1.mp4 \
#     -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls \
#     filename.m3u8

# ffmpeg -i Deque-1.mp4 \
#   -map 0:v:0 -map 0:a:0 \
#   -c:v libx264 -crf 22 -c:a aac -ar 48000 \
#   -filter:v:0 "scale=640:480" -maxrate:v:0 900k -bufsize:v:0 1800k -b:a:0 128k \
#   -filter:v:1 "scale=480:360" -maxrate:v:1 600k -bufsize:v:1 1200k -b:a:1 64k \
#   -var_stream_map "v:0,a:0,name:480p v:1,a:1,name:360p" \
#   -hls_list_size 0 -f hls \
#   -hls_time 10 -hls_flags independent_segments \
#   filename.m3u8

# ffmpeg -i Deque-1.mp4 \
#   -filter:v "scale=640:480" -c:v libx264 -b:v 900k -hls_time 10 -hls_list_size 0 -f hls output_480.m3u8

# ffmpeg -i Deque-1.mp4 \
#   -filter:v "scale=480:360" -c:v libx264 -b:v 600k -hls_time 10 -hls_list_size 0 -f hls output_360.m3u8

# ffmpeg -i Deque-1.mp4 \
#   -filter:v "scale=640:480" -c:v libx264 -b:v 900k \
#   -c:a aac -b:a 128k -hls_time 10 -hls_list_size 0 -f hls output_480.m3u8

ffmpeg -i Deque-1.mp4 -c:v libx264 -c:a aac -f hls -hls_time 10 -hls_list_size 0 output.m3u8