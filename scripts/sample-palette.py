"""Sample the supplied reference without dependencies. Convert PNG with macOS sips first."""
import colorsys, json, random, struct, sys
from collections import Counter
from pathlib import Path

def read_bmp(path):
    data=Path(path).read_bytes()
    offset=struct.unpack_from('<I',data,10)[0]
    w,h=struct.unpack_from('<ii',data,18)
    bits=struct.unpack_from('<H',data,28)[0]
    if bits not in (24,32): raise ValueError('Expected 24/32-bit BMP')
    stride=((w*bits+31)//32)*4
    return [tuple(data[offset+y*stride+x*(bits//8):offset+y*stride+x*(bits//8)+3][::-1]) for y in range(abs(h)) for x in range(w)]

def cluster(pixels,k):
    # Weighted k-means in sRGB: representative colors, not claims about physical pigments.
    counts=Counter(tuple((c//8)*8+4 for c in p) for p in pixels)
    points=list(counts)
    centers=[max(points,key=counts.get)]
    dist=lambda a,b:sum((x-y)**2 for x,y in zip(a,b))
    for _ in range(k-1): centers.append(max(points,key=lambda p:min(dist(p,c) for c in centers)*counts[p]**.35))
    for _ in range(16):
        groups=[[] for c in centers]
        for p in points: groups[min(range(k),key=lambda j:dist(p,centers[j]))].append(p)
        centers=[tuple(sum(p[i]*counts[p] for p in g)/sum(counts[p] for p in g) for i in range(3)) if g else centers[j] for j,g in enumerate(groups)]
    return ['#%02x%02x%02x'%tuple(round(v) for v in c) for c in centers]

pixels=read_bmp(sys.argv[1])
groups={'water':[],'leaf':[],'flower':[],'highlights':[]}
for p in pixels:
    h,s,v=colorsys.rgb_to_hsv(*(c/255 for c in p))
    if .45<h<.72 and s>.18:groups['water'].append(p)
    if .20<h<=.45 and s>.16:groups['leaf'].append(p)
    if (h>.80 or h<.10) and s>.12 and v>.43:groups['flower'].append(p)
    if s<.25 and v>.65:groups['highlights'].append(p)
result={'source':'User reference: codex-clipboard-3PK2va.png','method':'HSV groups + weighted sRGB k-means; 8-level channel histogram bins','pixelCount':len(pixels),'colors':{key:cluster(ps,{'water':10,'leaf':6,'flower':4,'highlights':3}[key]) for key,ps in groups.items()}}
print(json.dumps(result,indent=2))
