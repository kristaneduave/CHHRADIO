import sys

with open('components/SearchScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_badge = """                  {isRecent && (
                    <span className={`absolute top-[-3px] -left-2 px-2 py-0.5 rounded-[4px] text-[9px] leading-none font-bold tracking-wider uppercase z-20 ${typeMeta.unreadBadgeClass}`}>
                      New
                    </span>
                  )}"""

content = content.replace(old_badge, '')

old_title_block = """                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          <h4 className={`text-[14px] sm:text-[15px] truncate tracking-tight font-bold ${typeMeta.tintClass}`}>
                            {p.name}
                          </h4>
                        </div>"""

new_title_block = """                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          <h4 className={`text-[14px] sm:text-[15px] truncate tracking-tight font-bold ${typeMeta.tintClass}`}>
                            {p.name}
                          </h4>
                          {isRecent && (
                            <span className={`px-1.5 py-[3px] rounded-[4px] text-[9px] leading-none font-bold tracking-wider uppercase shrink-0 ${typeMeta.unreadBadgeClass}`}>
                              New
                            </span>
                          )}
                        </div>"""

content = content.replace(old_title_block, new_title_block)

with open('components/SearchScreen.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Done')
