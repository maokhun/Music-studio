@echo off
title RouteNote Audio Converter (44.1kHz 320kbps MP3 / FLAC)
color 0A
echo ================================================================
echo   🎵 RouteNote Audio Converter for RouteNote / Spotify
echo ================================================================
echo.
echo Please drag and drop your audio file (MP3/WAV) onto this window,
echo or type the full file path below:
echo.

set /p INPUT_FILE="Audio File Path: "
set INPUT_FILE=%INPUT_FILE:"=%

if not exist "%INPUT_FILE%" (
    echo.
    echo ❌ ERROR: File not found. Please try again.
    pause
    exit /b
)

set FFMPEG="C:\Users\LK Technology\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe"

echo.
echo [1/2] Converting to RouteNote 44.1kHz 320kbps MP3...
"%FFMPEG%" -y -i "%INPUT_FILE%" -ar 44100 -ab 320k -id3v2_version 3 "%~dpn1_RouteNote_441kHz.mp3"

echo.
echo [2/2] Converting to RouteNote 44.1kHz Lossless FLAC...
"%FFMPEG%" -y -i "%INPUT_FILE%" -ar 44100 -sample_fmt s16 "%~dpn1_RouteNote_441kHz.flac"

echo.
echo ================================================================
echo   ✅ SUCCESS! Created 2 RouteNote-ready files:
echo   1. %~dpn1_RouteNote_441kHz.mp3
echo   2. %~dpn1_RouteNote_441kHz.flac
echo ================================================================
echo.
pause
