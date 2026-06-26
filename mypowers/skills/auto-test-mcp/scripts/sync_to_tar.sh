#!/bin/bash
# 同步 tp-failure-analyzer skill 到 tar 目录
SKILL_DIR="C:/Users/User/.claude/skills/tp-failure-analyzer"
TAR_DIR="D:/AI-Native/ai_dataidentify_team/tar/tp-failure-analyzer"

rm -rf "$TAR_DIR"
cp -r "$SKILL_DIR" "$TAR_DIR"
echo "已同步 tp-failure-analyzer 到 tar 目录"
