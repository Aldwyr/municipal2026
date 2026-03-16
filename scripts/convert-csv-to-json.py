#!/usr/bin/env python3
"""Convert data.gouv.fr municipales 2026 CSV to department-level JSON files."""
import csv
import json
import os
import sys

# Nuance politique → bord + color mapping
NUANCE_MAP = {
    'LEXG': {'bord': 'Extrême gauche', 'color': 'var(--lfi)', 'family': 'lfi'},
    'LFI':  {'bord': 'Extrême gauche', 'color': 'var(--lfi)', 'family': 'lfi'},
    'LCOM': {'bord': 'Gauche', 'color': 'var(--pcf)', 'family': 'gauche'},
    'LSOC': {'bord': 'Gauche', 'color': 'var(--ps)', 'family': 'gauche'},
    'LDVG': {'bord': 'Gauche', 'color': 'var(--ps)', 'family': 'gauche'},
    'LUG':  {'bord': 'Gauche', 'color': 'var(--ps)', 'family': 'gauche'},
    'LECO': {'bord': 'Centre-gauche', 'color': 'var(--eco)', 'family': 'gauche'},
    'LVEC': {'bord': 'Centre-gauche', 'color': 'var(--eco)', 'family': 'gauche'},
    'LDVC': {'bord': 'Centre', 'color': 'var(--re)', 'family': 'droite'},
    'LUC':  {'bord': 'Centre', 'color': 'var(--re)', 'family': 'droite'},
    'LREN': {'bord': 'Centre', 'color': 'var(--re)', 'family': 'droite'},
    'LREG': {'bord': 'Centre', 'color': 'var(--re)', 'family': 'droite'},
    'LLR':  {'bord': 'Droite', 'color': 'var(--lr)', 'family': 'droite'},
    'LUD':  {'bord': 'Droite', 'color': 'var(--lr)', 'family': 'droite'},
    'LDVD': {'bord': 'Droite', 'color': 'var(--lr)', 'family': 'droite'},
    'LUDI': {'bord': 'Droite', 'color': 'var(--lr)', 'family': 'droite'},
    'LUDR': {'bord': 'Droite souverainiste', 'color': 'var(--udr)', 'family': 'droite'},
    'LRN':  {'bord': 'Extrême droite', 'color': 'var(--rn)', 'family': 'rn'},
    'LEXD': {'bord': 'Extrême droite', 'color': 'var(--rn)', 'family': 'rn'},
    'LUXD': {'bord': 'Extrême droite', 'color': 'var(--rn)', 'family': 'rn'},
    'LREC': {'bord': 'Extrême droite', 'color': 'var(--rec)', 'family': 'rn'},
    'LDIV': {'bord': 'Divers', 'color': 'var(--div)', 'family': 'divers'},
    'LDSV': {'bord': 'Divers', 'color': 'var(--div)', 'family': 'divers'},
}

def parse_pct(val):
    """Parse '55,08%' or '55.08' → float."""
    if not val:
        return 0.0
    val = val.strip().strip('"').replace('%', '').replace(',', '.').strip()
    try:
        return round(float(val), 2)
    except ValueError:
        return 0.0

def parse_int(val):
    if not val:
        return 0
    val = val.strip().strip('"')
    try:
        return int(val)
    except ValueError:
        return 0

def get_bord_family(lead_bord):
    """Map leading candidate's bord to a simplified family for the commune."""
    families = {
        'Extrême gauche': 'gauche',
        'Gauche': 'gauche',
        'Centre-gauche': 'gauche',
        'Centre': 'centre',
        'Droite': 'droite',
        'Droite souverainiste': 'droite',
        'Extrême droite': 'rn',
        'Divers': 'indecis',
    }
    return families.get(lead_bord, 'indecis')

def process_csv(csv_path, output_dir):
    dept_data = {}  # dept_code -> list of communes

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        header = next(reader)

        for row in reader:
            if len(row) < 18:
                continue

            dept_code = row[0].strip().strip('"')
            dept_name = row[1].strip().strip('"')
            commune_code = row[2].strip().strip('"')
            commune_name = row[3].strip().strip('"')
            inscrits = parse_int(row[4])
            votants = parse_int(row[5])
            participation = parse_pct(row[6])
            exprimes = parse_int(row[9])

            # Parse candidates (13 columns each, starting at index 18)
            candidats = []
            i = 18
            while i + 12 < len(row):
                nom_cand = row[i+1].strip().strip('"') if i+1 < len(row) else ''
                prenom = row[i+2].strip().strip('"') if i+2 < len(row) else ''
                nuance = row[i+4].strip().strip('"') if i+4 < len(row) else ''
                lib_abrege = row[i+5].strip().strip('"') if i+5 < len(row) else ''
                voix = parse_int(row[i+7]) if i+7 < len(row) else 0
                pct_exprimes = parse_pct(row[i+9]) if i+9 < len(row) else 0.0
                elu_str = row[i+10].strip().strip('"') if i+10 < len(row) else ''

                if not nom_cand and not lib_abrege:
                    i += 13
                    continue

                nuance_info = NUANCE_MAP.get(nuance, {'bord': 'Divers', 'color': 'var(--div)', 'family': 'divers'})

                display_name = f"{prenom[0]}. {nom_cand}" if prenom and nom_cand else (nom_cand or lib_abrege)

                # Sièges au CM (col i+11)
                sieges_cm = parse_int(row[i+11]) if i+11 < len(row) else 0

                candidats.append({
                    'nom': display_name,
                    'parti': lib_abrege or nuance,
                    'nuance': nuance,
                    'bord': nuance_info['bord'],
                    'score': pct_exprimes,
                    'color': nuance_info['color'],
                    'voix': voix,
                    'sieges': sieges_cm,
                })
                i += 13

            # Sort by score descending
            candidats.sort(key=lambda c: c['score'], reverse=True)

            # Determine status: if any list has seats > 0, council was formed at 1st round
            has_seats = any(c['sieges'] > 0 for c in candidats)
            status = 'elu' if has_seats else '2t'

            # Determine bord (from leading candidate)
            lead_bord = 'indecis'
            if candidats:
                lead_family = NUANCE_MAP.get(candidats[0].get('nuance', ''), {}).get('family', 'divers')
                lead_bord = lead_family if lead_family in ('gauche', 'droite', 'rn', 'centre') else 'indecis'

            commune = {
                'code': commune_code,
                'nom': commune_name,
                'inscrits': inscrits,
                'votants': votants,
                'participation': participation,
                'status': status,
                'bord': lead_bord,
                'candidats': [
                    {k: v for k, v in c.items() if k not in ('voix', 'nuance', 'sieges')}
                    for c in candidats
                ],
            }

            if dept_code not in dept_data:
                dept_data[dept_code] = {'nom': dept_name, 'communes': []}
            dept_data[dept_code]['communes'].append(commune)

    # Write department JSON files
    os.makedirs(output_dir, exist_ok=True)
    total_communes = 0
    for dept_code, data in sorted(dept_data.items()):
        filepath = os.path.join(output_dir, f'{dept_code}.json')
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        total_communes += len(data['communes'])
        print(f"  {dept_code} ({data['nom']}): {len(data['communes'])} communes — {os.path.getsize(filepath)//1024}KB")

    print(f"\nTotal: {len(dept_data)} départements, {total_communes} communes")

if __name__ == '__main__':
    csv_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/municipales-2026-resultats.csv'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'dept')
    process_csv(csv_path, output_dir)
