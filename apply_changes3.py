import re
import sys

with open('components/PathologyChecklistScreen.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Update RadioGraphicsTopicHub interface
content = re.sub(
    r'  featuredItems: PathologyGuidelineListItem\[\];\n\}',
    r'''  featuredItems: PathologyGuidelineListItem[];
  colorClass?: {
    base: string;
    text: string;
    activeBg: string;
    activeBorder: string;
    hoverBg: string;
    iconActive: string;
    iconInactive: string;
  };
}''',
    content,
    count=1
)

# 2. Update CURATED_TRAINING_HUBS array elements
replacements = {
    "'chest'": ("'air'", """    colorClass: {
      base: 'cyan',
      text: 'text-cyan-400',
      activeBg: 'bg-cyan-950/[0.16]',
      activeBorder: 'border-cyan-400/18',
      hoverBg: 'hover:bg-cyan-500/[0.04]',
      iconActive: 'text-cyan-200',
      iconInactive: 'text-cyan-400/60',
    }"""),
    "'abdomen'": ("'dashboard'", """    colorClass: {
      base: 'emerald',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-950/[0.16]',
      activeBorder: 'border-emerald-400/18',
      hoverBg: 'hover:bg-emerald-500/[0.04]',
      iconActive: 'text-emerald-200',
      iconInactive: 'text-emerald-400/60',
    }"""),
    "'gu-obgyn'": ("'water_drop'", """    colorClass: {
      base: 'pink',
      text: 'text-pink-400',
      activeBg: 'bg-pink-950/[0.16]',
      activeBorder: 'border-pink-400/18',
      hoverBg: 'hover:bg-pink-500/[0.04]',
      iconActive: 'text-pink-200',
      iconInactive: 'text-pink-400/60',
    }"""),
    "'neuro-head-neck'": ("'neurology'", """    colorClass: {
      base: 'purple',
      text: 'text-purple-400',
      activeBg: 'bg-purple-950/[0.16]',
      activeBorder: 'border-purple-400/18',
      hoverBg: 'hover:bg-purple-500/[0.04]',
      iconActive: 'text-purple-200',
      iconInactive: 'text-purple-400/60',
    }""", "'psychology'"), # Replace icon too
    "'musculoskeletal'": ("'accessibility_new'", """    colorClass: {
      base: 'orange',
      text: 'text-orange-400',
      activeBg: 'bg-orange-950/[0.16]',
      activeBorder: 'border-orange-400/18',
      hoverBg: 'hover:bg-orange-500/[0.04]',
      iconActive: 'text-orange-200',
      iconInactive: 'text-orange-400/60',
    }""", "'directions_run'"), # Replace icon too
    "'breast'": ("'favorite'", """    colorClass: {
      base: 'fuchsia',
      text: 'text-fuchsia-400',
      activeBg: 'bg-fuchsia-950/[0.16]',
      activeBorder: 'border-fuchsia-400/18',
      hoverBg: 'hover:bg-fuchsia-500/[0.04]',
      iconActive: 'text-fuchsia-200',
      iconInactive: 'text-fuchsia-400/60',
    }""", "'monitor_heart'"), # Replace icon too
    "'pediatrics'": ("'child_care'", """    colorClass: {
      base: 'amber',
      text: 'text-amber-400',
      activeBg: 'bg-amber-950/[0.16]',
      activeBorder: 'border-amber-400/18',
      hoverBg: 'hover:bg-amber-500/[0.04]',
      iconActive: 'text-amber-200',
      iconInactive: 'text-amber-400/60',
    }"""),
    "'procedures-ir'": ("'medical_services'", """    colorClass: {
      base: 'rose',
      text: 'text-rose-400',
      activeBg: 'bg-rose-950/[0.16]',
      activeBorder: 'border-rose-400/18',
      hoverBg: 'hover:bg-rose-500/[0.04]',
      iconActive: 'text-rose-200',
      iconInactive: 'text-rose-400/60',
    }""", "'healing'"), # Replace icon too
    "'general-other'": ("'category'", """    colorClass: {
      base: 'slate',
      text: 'text-slate-400',
      activeBg: 'bg-slate-800/[0.16]',
      activeBorder: 'border-slate-400/18',
      hoverBg: 'hover:bg-slate-500/[0.04]',
      iconActive: 'text-slate-200',
      iconInactive: 'text-slate-400/60',
    }""", "'library_books'"), # Replace icon too
}

for id_str, replacement_data in replacements.items():
    old_icon, color_block = replacement_data[:2]
    new_icon = replacement_data[2] if len(replacement_data) > 2 else old_icon
    
    # regex to match the item block
    pattern = rf"(id: {id_str},\n    topic: '[^']+',\n    icon: ){old_icon}(,\n    description: '[^']+',\n    activeDescription: '[^']+',\n    matchers: \[[^\]]+\],)"
    
    content = re.sub(pattern, rf"\g<1>{new_icon}\g<2>\n{color_block}", content, count=1)

# 3. Update buildCuratedTopicHubs
content = re.sub(
    r'      tags: Array\.from\(new Set\(hubItems\.flatMap\(\(item\) => \[\.\.\.item\.clinical_tags, \.\.\.item\.problem_terms\]\)\.filter\(Boolean\)\)\)\.slice\(0, 4\),\n      featuredItems: hubItems\.slice\(0, 3\),\n    \};\n  \}\)\.filter\(\(hub\) => hub\.count > 0\);',
    r'''      tags: Array.from(new Set(hubItems.flatMap((item) => [...item.clinical_tags, ...item.problem_terms]).filter(Boolean))).slice(0, 4),
      featuredItems: hubItems.slice(0, 3),
      colorClass: (hub as any).colorClass,
    };
  });''',
    content,
    count=1
)

# 4. Update TopicHubGrid
old_grid = '''  <div className="grid grid-cols-2 auto-rows-auto gap-2 sm:grid-cols-3">
    {hubs.map((hub) => {
      const active = hub.topic === activeTopic;
      return (
        <button
          key={hub.id}
          type="button"
          onClick={() => onSelectTopic(hub.topic)}
          className={`w-full rounded-2xl border px-4 py-5 text-left transition ${active ? 'border-cyan-400/18 bg-cyan-950/[0.16]' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'}`}
          aria-label={`${hub.topic}, ${hub.count} ${hub.count === 1 ? 'guide' : 'guides'}`}
        >
          <span className={`material-icons text-[24px] ${active ? 'text-cyan-200' : 'text-cyan-300'}`}>{hub.icon}</span>
          <div className="mt-3 min-w-0">
            <p className="text-sm font-semibold text-white">{hub.topic}</p>
          </div>
        </button>
      );
    })}
  </div>'''

new_grid = '''  <div className="grid grid-cols-2 auto-rows-auto gap-2 sm:grid-cols-3">
    {hubs.map((hub) => {
      const active = hub.topic === activeTopic;
      const c = hub.colorClass || {
        base: 'cyan',
        text: 'text-cyan-400',
        activeBg: 'bg-cyan-950/[0.16]',
        activeBorder: 'border-cyan-400/18',
        hoverBg: 'hover:bg-cyan-500/[0.04]',
        iconActive: 'text-cyan-200',
        iconInactive: 'text-cyan-400/60',
      };
      return (
        <button
          key={hub.id}
          type="button"
          onClick={() => onSelectTopic(hub.topic)}
          className={`w-full rounded-2xl border px-3 sm:px-4 py-4 sm:py-5 text-left transition relative overflow-hidden group ${active ? `${c.activeBorder} ${c.activeBg}` : `border-white/[0.05] bg-white/[0.02] ${c.hoverBg}`}`}
          aria-label={`${hub.topic}, ${hub.count} ${hub.count === 1 ? 'guide' : 'guides'}`}
        >
          {/* subtle background glow on hover */}
          <div className={`absolute inset-0 bg-gradient-to-br from-${c.base}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          
          <div className="relative z-10 flex flex-col min-h-[70px] sm:min-h-[80px]">
            <div className="flex items-start justify-between mb-auto">
              <span className={`material-icons text-[24px] sm:text-[28px] ${active ? c.iconActive : c.iconInactive} group-hover:${c.iconActive} transition-colors`}>{hub.icon}</span>
              {hub.count > 0 && (
                <span className={`text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md bg-white/5 border border-white/10 ${active ? c.text : 'text-slate-500'}`}>{hub.count}</span>
              )}
            </div>
            <div className="mt-3 min-w-0">
              <p className={`text-[13px] sm:text-[14px] font-bold sm:font-semibold transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{hub.topic}</p>
            </div>
          </div>
        </button>
      );
    })}
  </div>'''

content = content.replace(old_grid, new_grid)

with open('components/PathologyChecklistScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
