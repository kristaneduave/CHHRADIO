import sys

with open('components/NewsfeedPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. uppercase the heading class
content = content.replace(
    '''<h4 className={`text-[14px] sm:text-[15px] truncate tracking-tight ${notif.read ? 'font-medium text-slate-200' : 'font-bold text-white'}`}>''',
    '''<h4 className={`text-[14px] sm:text-[15px] uppercase truncate tracking-wider ${notif.read ? 'font-bold text-slate-400' : 'font-bold text-white'}`}>'''
)

# 2. remove the `New` badge block
old_badge = """                            {!notif.read && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] leading-none font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/35 shrink-0 mt-0.5">
                                New
                              </span>
                            )}"""

old_badge_norm = old_badge.replace('\n', '\r\n')
content = content.replace(old_badge, '')
content = content.replace(old_badge_norm, '')

with open('components/NewsfeedPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
