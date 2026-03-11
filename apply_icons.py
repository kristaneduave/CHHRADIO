import re

with open('components/PathologyChecklistScreen.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace icons
replacements = {
    "'chest'": "'pulmonology'",
    "'abdomen'": "'gastroenterology'",
    "'gu-obgyn'": "'pregnant_woman'",
    "'neuro-head-neck'": "'neurology'",
    "'musculoskeletal'": "'orthopedics'",
    "'breast'": "'monitor_heart'",
    "'pediatrics'": "'pediatrics'",
    "'procedures-ir'": "'vaccines'",
    "'general-other'": "'medical_information'"
}

for id_str, new_icon in replacements.items():
    pattern = rf"(id: {id_str},\n    topic: '[^']+',\n    icon: )'[^']+'"
    content = re.sub(pattern, rf"\g<1>{new_icon}", content, count=1)

# Replace the inner button div
old_inner_div = '''            <div className="relative z-10 flex flex-col min-h-[60px] sm:min-h-[80px]">
              <div className="flex items-start justify-between mb-auto">
                <span className={material-icons text-[20px] sm:text-[28px]  group-hover: transition-colors}>{hub.icon}</span>
                {hub.count > 0 && (
                  <span className={	ext-[9px] sm:text-[11px] font-black tracking-widest px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 border border-white/10 }>{hub.count}</span>
                )}
              </div>
              <div className="mt-2 sm:mt-3 min-w-0">
                <p className={	ext-[10px] sm:text-[14px] font-bold sm:font-semibold transition-colors leading-tight }>{hub.topic}</p>
              </div>
            </div>'''

new_inner_div = '''            {hub.count > 0 && (
              <span className={bsolute top-2 right-2 text-[9px] sm:text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 }>{hub.count}</span>
            )}
            <div className="relative z-10 flex flex-col items-center justify-center text-center h-full min-h-[70px] sm:min-h-[90px] gap-1.5 sm:gap-2">
              <span className={material-icons text-[28px] sm:text-[32px] mb-1  group-hover: transition-colors}>{hub.icon}</span>
              <p className={	ext-[11px] sm:text-[13px] font-bold sm:font-semibold transition-colors leading-tight px-1 }>{hub.topic}</p>
            </div>'''

content = content.replace(old_inner_div, new_inner_div)

with open('components/PathologyChecklistScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
