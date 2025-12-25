#!/usr/bin/env python3
"""
準備小狐熊週記文章資料
"""

import json
import re
from pathlib import Path

def get_eligible_articles():
    """取得符合日期範圍的小狐熊週記"""
    blog_dir = Path(__file__).parent.parent.parent / 'reference' / 'blog_articles'
    articles = []

    for file in sorted(blog_dir.glob('*.md')):
        filename = file.name
        date_str = filename[:10]

        # 檢查日期範圍：2024-12-25 ~ 2025-12-24
        if not (date_str > '2024-12-24' and date_str < '2025-12-25'):
            continue

        # 只要小狐熊週記
        if '小狐熊週記' not in filename:
            continue

        # 讀取文章內容
        content = file.read_text(encoding='utf-8')

        # 解析標題
        title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
        title = title_match.group(1) if title_match else filename

        # 解析原文連結
        link_match = re.search(r'\*\*原文連結\*\*: (.+)$', content, re.MULTILINE)
        link = link_match.group(1) if link_match else ''

        # 取得正文（從第一個 --- 之後開始，保留文章內的所有 ---）
        parts = content.split('---', 1)
        body = parts[1].strip() if len(parts) > 1 else content

        articles.append({
            'id': filename.replace('.md', ''),
            'title': title,
            'date': date_str,
            'link': link,
            'content': body
        })

    return articles

if __name__ == '__main__':
    articles = get_eligible_articles()
    print(f"找到 {len(articles)} 篇文章")

    # 儲存文章資料
    output_path = Path(__file__).parent / 'data' / 'articles.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"已儲存到 {output_path}")

    # 顯示文章清單
    for i, article in enumerate(articles, 1):
        print(f"{i}. {article['date']} - {article['title']}")
