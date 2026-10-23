# -*- coding: utf-8 -*-
"""
Compilador Maestro de Manuales Oficiales BICSA en PDF
Ejecuta la generacion de los 4 manuales:
1. MANUAL_TECNICO_SISTEMA_BICSA.pdf
2. MANUAL_USUARIO_EJECUTIVO_BICSA.pdf
3. MANUAL_USUARIO_ADMINISTRADOR_BICSA.pdf
4. MANUAL_USUARIO_GERENTE_COMERCIAL_BICSA.pdf
"""

import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SCRIPTS = [
    "make_manual_tecnico.py",
    "make_manual_ejecutivo.py",
    "make_manual_admin.py",
    "make_manual_gerente.py",
]

def main():
    print("=" * 60)
    print("GENERADOR MAESTRO DE MANUALES OFICIALES BICSA (V1.3)")
    print("=" * 60)

    for script in SCRIPTS:
        script_path = os.path.join(BASE_DIR, script)
        print(f"\n---> Ejecutando {script}...")
        res = subprocess.run([sys.executable, script_path], check=True)
        if res.returncode != 0:
            print(f"Error al ejecutar {script}")
            return

    print("\n" + "=" * 60)
    print("¡TODOS LOS MANUALES FUERON COMPILADOS EXITOSAMENTE EN PDF!")
    print(f"Ubicación de archivos: {BASE_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
