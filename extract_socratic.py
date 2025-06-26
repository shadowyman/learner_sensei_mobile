with open('Modules.txt', 'r') as f:
    lines = f.readlines()

modules = []
current_module = None
in_socratic = False
socratic_content = []

for i, line in enumerate(lines):
    # Module headers
    if line.startswith('Module ') and ':' in line:
        if current_module and socratic_content:
            modules.append({
                'name': current_module,
                'socratic': ''.join(socratic_content).strip()
            })
        current_module = line.strip()
        in_socratic = False
        socratic_content = []
    
    # Socratic section start
    elif line.strip() == 'Socratic:':
        in_socratic = True
        socratic_content = []
    
    # Other section headers (end of Socratic)
    elif in_socratic and line.strip() and line[0].isalpha() and ':' in line and not line[0].isspace():
        if line.strip() not in ['a.', 'b.', 'c.', 'd.', 'e.', 'f.', 'i.', 'ii.', 'iii.']:
            in_socratic = False
    
    # Collect Socratic content
    elif in_socratic:
        socratic_content.append(line)

# Don't forget the last module
if current_module and socratic_content:
    modules.append({
        'name': current_module,
        'socratic': ''.join(socratic_content).strip()
    })

# Print results
for i, mod in enumerate(modules):
    print(f"\n{'='*80}")
    print(f"MODULE: {mod['name']}")
    print(f"{'='*80}")
    print(f"SOCRATIC SECTION:")
    print(mod['socratic'])
