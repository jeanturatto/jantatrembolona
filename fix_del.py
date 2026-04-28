import sys, os
for root, dirs, files in os.walk('D:/IA/jantatrembo/dist'):
    for f in files:
        if 'index' in f and f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                d = open(path, 'r', encoding='utf-8', errors='replace').read()
                i = d.find('ratings').find('delete')
                if i > 0:
                    print(f'FILE: {f}')
                    print(repr(d[i:i+200]))
                    print('---')
            except: pass