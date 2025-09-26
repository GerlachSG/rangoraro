import os
import re # Módulo de expressões regulares, necessário para a limpeza avançada
import unicodedata

# --------------------------------------------------------------------------
# --- CONFIGURAÇÃO ---
#
# !!! IMPORTANTE !!!
# Coloque aqui o caminho COMPLETO para a sua pasta de imagens.
#
caminho_da_pasta = r"C:\Users\skill50\Downloads\arriba"
#
# --------------------------------------------------------------------------


def limpar_nome(nome_original):
    """
    Esta função foi atualizada para ser idêntica à função createIdFromString do JavaScript.
    """
    # 1. Separa o nome base da extensão do arquivo
    nome_base, extensao = os.path.splitext(nome_original)

    # 2. Converte para minúsculas
    nome_minusculo = nome_base.lower()

    # 3. Remove acentos
    nome_sem_acentos = unicodedata.normalize('NFKD', nome_minusculo).encode('ascii', 'ignore').decode('utf-8')
    
    # 4. Remove qualquer caractere que NÃO seja letra, número, espaço ou hífen
    # Exatamente como o .replace(/[^a-z0-9\s-]/g, '') do JavaScript
    nome_caracteres_validos = re.sub(r'[^a-z0-9\s-]', '', nome_sem_acentos)

    # 5. Remove espaços extras no início e no fim
    nome_sem_espacos_extras = nome_caracteres_validos.strip()

    # 6. Substitui um ou mais espaços por um único hífen
    # Exatamente como o .replace(/\s+/g, '-') do JavaScript
    nome_com_hifen = re.sub(r'\s+', '-', nome_sem_espacos_extras)

    # 7. Junta o novo nome com a extensão original em minúsculo
    novo_nome = f"{nome_com_hifen}{extensao.lower()}"
    
    return novo_nome

# --- INÍCIO DA EXECUÇÃO (NENHUMA MUDANÇA ABAIXO) ---

if not os.path.isdir(caminho_da_pasta):
    print(f"\nERRO: A pasta '{caminho_da_pasta}' não foi encontrada ou não é um diretório válido.")
    print("Por favor, edite o script e coloque o caminho correto.")
else:
    try:
        print(f"Analisando arquivos em: {caminho_da_pasta}\n")
        arquivos = os.listdir(caminho_da_pasta)
        total_renomeado = 0

        # Cria uma lista de todos os nomes finais para checar duplicatas
        nomes_finais_planejados = [limpar_nome(nome) for nome in arquivos if os.path.isfile(os.path.join(caminho_da_pasta, nome))]

        for nome_original in arquivos:
            caminho_original = os.path.join(caminho_da_pasta, nome_original)

            if os.path.isfile(caminho_original):
                novo_nome = limpar_nome(nome_original)

                if novo_nome != nome_original:
                    caminho_novo = os.path.join(caminho_da_pasta, novo_nome)
                    
                    # Checa se o novo nome já existe (conflito)
                    if nomes_finais_planejados.count(novo_nome) > 1:
                        print(f'AVISO: O nome final "{novo_nome}" seria duplicado. Pulando o arquivo "{nome_original}".')
                        continue

                    # Renomeia de forma segura para evitar conflitos de case no Windows
                    temp_name = f"temp_{nome_original}"
                    caminho_temporario = os.path.join(caminho_da_pasta, temp_name)
                    
                    print(f'Renomeando: "{nome_original}" -> "{novo_nome}"')
                    
                    os.rename(caminho_original, caminho_temporario)
                    os.rename(caminho_temporario, caminho_novo)
                    
                    total_renomeado += 1

        print(f"\nConcluído! {total_renomeado} arquivo(s) foi(ram) renomeado(s).")

    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")