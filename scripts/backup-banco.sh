#!/usr/bin/env bash
# Dump completo do banco de produção (Neon).
#
# Usado pelo backup diário (.github/workflows/backup-banco.yml) e também
# rodável na mão. Precisa da variável DATABASE_URL_BACKUP com a connection
# string DIRETA da Neon (sem "-pooler" no host — ver abaixo).
#
#   DATABASE_URL_BACKUP="postgresql://..." ./scripts/backup-banco.sh [pasta]
#
# Restaurar: ver "Backup e restauração" no README.md.
set -euo pipefail

destino="${1:-backups}"
url="${DATABASE_URL_BACKUP:-}"

if [ -z "$url" ]; then
  echo "ERRO: defina DATABASE_URL_BACKUP com a connection string da Neon." >&2
  exit 1
fi

# O endpoint com pooler é PgBouncer em modo transaction, que não suporta as
# transações longas e o LOCK que o pg_dump usa — o dump sai truncado ou falha.
case "$url" in
  *-pooler.*)
    echo "ERRO: essa é a URL do pooler. Use a conexão direta (host sem '-pooler')." >&2
    exit 1
    ;;
esac

mkdir -p "$destino"
base="$destino/monpetit-$(date -u +%Y-%m-%dT%H%M%SZ)"
arquivo="$base.dump"
# O carimbo tem resolução de 1 segundo, então duas execuções seguidas geram o
# mesmo nome. Sem isso a segunda sobrescreve a primeira em silêncio — e se ela
# falhar na checagem de tamanho, leva junto um backup que estava bom.
n=2
while [ -e "$arquivo" ]; do
  arquivo="$base-$n.dump"
  n=$((n + 1))
done

# --format=custom: comprimido e permite restauração seletiva (uma tabela só).
# --no-owner/--no-privileges: o dump restaura em qualquer role, o que importa
# porque o usuário do banco restaurado raramente é o mesmo da produção.
pg_dump --format=custom --no-owner --no-privileges --file="$arquivo" "$url"

tamanho=$(wc -c < "$arquivo")
# Dump vazio saindo com código 0 é a falha silenciosa clássica de backup: o
# job fica verde por meses e só na hora de restaurar se descobre que não há
# nada dentro. Qualquer banco com o schema do Mon Petit passa de 2 KB.
if [ "$tamanho" -lt 2048 ]; then
  # Apaga o arquivo: um dump truncado parado na pasta de backups é pior que
  # nenhum, porque alguém pode restaurá-lo achando que está íntegro.
  rm -f "$arquivo"
  echo "ERRO: dump tem só $tamanho bytes — descartado e tratado como falha." >&2
  exit 1
fi

echo "Backup gerado: $arquivo ($tamanho bytes)"
