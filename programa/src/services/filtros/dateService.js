class PeriodoService {
    constructor() {
        this.meses = {
            'janeiro': 0, 'jan': 0,
            'fevereiro': 1, 'fev': 1,
            'marco': 2, 'mar': 2,
            'abril': 3, 'abr': 3,
            'maio': 4, 'mai': 4,
            'junho': 5, 'jun': 5,
            'julho': 6, 'jul': 6,
            'agosto': 7, 'ago': 7,
            'setembro': 8, 'set': 8,
            'outubro': 9, 'out': 9,
            'novembro': 10, 'nov': 10,
            'dezembro': 11, 'dez': 11
        };

        this.numerais = {
            'primeiro': 1,
            'segundo': 2,
            'terceiro': 3,
            'quarto': 4,
            'quinto': 5,
            'sexto': 6
        };

        this.periodosAgrupados = {
            'bimestre': 2,
            'trimestre': 3,
            'quadrimestre': 4,
            'semestre': 6
        };
    }

    extrair(frase, anoReferencia) {
        if (!frase || !this._deveAtivar(frase)) return [];

        const hoje = new Date();
        const anoAtual = anoReferencia || hoje.getFullYear();

        // Ano isolado limitado a 2020-2035; palavra "acao" antes bloqueia captura
        const regexGeral = /(?<!\bacao\s{0,5})(?<!\bacao)\b(?:\d{1,2}\s+de\s+)?(?:\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{2,4})?|20(?:2[0-9]|3[0-5])\b|(?:(?:primeiro|segundo|terceiro|quarto|quinto|sexto|\d+\s*[oº°])\s+)?(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|bimestre|trimestre|quadrimestre|semestre))(?:\s+(?:de\s+)?(?:20(?:2[0-9]|3[0-5])))?/gi;

        let fragmentos = [];
        let match;

        while ((match = regexGeral.exec(frase)) !== null) {
            // Bloqueia se a palavra "acao" precede o trecho (guarda extra além do lookbehind)
            const precedente = frase.substring(0, match.index).trimEnd().toLowerCase();
            if (/\bacao$/.test(precedente)) continue;

            const info = this._parseFragmento(match[0], anoAtual, hoje);
            if (info) {
                fragmentos.push({
                    inicio: info.inicio,
                    fim: info.fim,
                    texto: match[0],
                    index: match.index,
                    length: match[0].length,
                    anoExplicito: info.anoExplicito
                });
            }
        }

        if (fragmentos.length === 0) return [];

        // Backward: "maio e junho de 2024" -> maio herda 2024
        for (let i = fragmentos.length - 2; i >= 0; i--) {
            const atual = fragmentos[i];
            const proximo = fragmentos[i + 1];
            if (proximo.anoExplicito && !atual.anoExplicito) {
                const entre = frase.substring(atual.index + atual.length, proximo.index).trim().toLowerCase();
                if (entre === "" || /^(e|,|ou|a|ate|até)$/i.test(entre)) {
                    atual.inicio.setFullYear(proximo.inicio.getFullYear());
                    atual.fim.setFullYear(proximo.inicio.getFullYear());
                    atual.anoExplicito = true;
                }
            }
        }

        // Forward: "janeiro de 2024 e fevereiro" -> fevereiro herda 2024
        for (let i = 1; i < fragmentos.length; i++) {
            const anterior = fragmentos[i - 1];
            const atual = fragmentos[i];
            if (anterior.anoExplicito && !atual.anoExplicito) {
                const entre = frase.substring(anterior.index + anterior.length, atual.index).trim().toLowerCase();
                if (entre === "" || /^(e|,|ou|a|ate|até)$/i.test(entre)) {
                    atual.inicio.setFullYear(anterior.inicio.getFullYear());
                    atual.fim.setFullYear(anterior.inicio.getFullYear());
                    atual.anoExplicito = true;
                }
            }
        }

        const resultados = [];
        let atual = fragmentos[0];

        for (let i = 1; i < fragmentos.length; i++) {
            const proximo = fragmentos[i];
            const entreTrechos = frase
                .substring(atual.index + atual.length, proximo.index)
                .toLowerCase()
                .trim();

            if (/^(ate|até|a)$/i.test(entreTrechos)) {
                atual.fim = proximo.fim;
                atual.texto = frase.substring(atual.index, proximo.index + proximo.length);
                atual.length = atual.texto.length;
            } else {
                resultados.push(this._formatarSaida(atual));
                atual = proximo;
            }
        }

        resultados.push(this._formatarSaida(atual));
        return resultados;
    }

    _deveAtivar(frase) {
        if (!frase) return false;

        const regexMes = /\b(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)\b/i;
        const regexPeriodo = /\b(bimestre|trimestre|quadrimestre|semestre)\b/i;
        const regexDataNumerica = /\b\d{1,2}[\/\.]\d{1,2}([\/\.]\d{2,4})?\b/;

        return (
            regexMes.test(frase) ||
            regexPeriodo.test(frase) ||
            regexDataNumerica.test(frase)
        );
    }

    _parseFragmento(texto, anoReferencia, hoje) {
        const str = texto.toLowerCase().trim();

        let dia = 1;
        let mes = -1;
        let ano = anoReferencia;
        let ehAgrupado = false;
        let mesesDuracao = 1;
        let anoExplicito = false;

        const anoAtualSistema = hoje.getFullYear();
        // Ano isolado — apenas 4 dígitos e entre 2024 e o ano atual
        const matchAnoIsolado = str.match(/^\d{4}$/);
        if (matchAnoIsolado) {
            ano = parseInt(matchAnoIsolado[0]);
            if (ano < 2024 || ano > anoAtualSistema) return null;
            return {
                inicio: new Date(ano, 0, 1),
                fim: new Date(ano, 11, 31),
                anoExplicito: true
            };
        }

        // Períodos agrupados
        for (const [nome, meses] of Object.entries(this.periodosAgrupados)) {
            if (str.includes(nome)) {
                let ordinal = 1;

                for (const [nNome, nVal] of Object.entries(this.numerais)) {
                    if (str.includes(nNome)) {
                        ordinal = nVal;
                        break;
                    }
                }

                const mOrdinal = str.match(/(\d+)\s*[oº°]/);
                if (mOrdinal) {
                    ordinal = parseInt(mOrdinal[1]);
                }

                mes = (ordinal - 1) * meses;
                mesesDuracao = meses;
                ehAgrupado = true;
                break;
            }
        }

        // Data numérica
        const matchNumerico = str.match(/(\d{1,2})[\/\.](\d{1,2})/);
        if (matchNumerico) {
            dia = parseInt(matchNumerico[1]);
            mes = parseInt(matchNumerico[2]) - 1;
        }

        // Dia + mês por extenso
        const matchDiaMes = str.match(/(\d{1,2})\s+de\s+([a-z]+)/);
        if (matchDiaMes) {
            dia = parseInt(matchDiaMes[1]);
            mes = this.meses[matchDiaMes[2]] ?? -1;
        }

        // Apenas mês
        for (const [nome, idx] of Object.entries(this.meses)) {
            if (str.includes(nome)) {
                mes = idx;
                break;
            }
        }

        // Ano inline — apenas 4 dígitos e entre 2024 e o ano atual
        const matchAno = str.match(/\b(20\d{2})\b/);
        if (matchAno) {
            ano = parseInt(matchAno[1]);
            if (ano < 2024 || ano > anoAtualSistema) return null;
            anoExplicito = true;
        }

        if (mes === -1) return null;

        if (!anoExplicito) {
            const dataTeste = new Date(ano, mes, dia);
            if (dataTeste > hoje) ano -= 1;
        }

        const dataInicio = new Date(ano, mes, dia);

        let dataFim;

        if (ehAgrupado) {
            dataFim = new Date(ano, mes + mesesDuracao, 0);
        } else {
            const temDiaExplicito =
                /^\d{1,2}\s+de/i.test(str) ||
                /\d{1,2}[\/\.]\d{1,2}/.test(str);

            if (temDiaExplicito) {
                dataFim = new Date(ano, mes, dia);
            } else {
                dataFim = new Date(ano, mes + 1, 0);
            }
        }

        return { inicio: dataInicio, fim: dataFim, anoExplicito };
    }

    _formatarSaida(obj) {
        return {
            data_inicio: this._dateToStr(obj.inicio),
            data_fim: this._dateToStr(obj.fim),
            trecho_encontrado: obj.texto.trim()
        };
    }

    _dateToStr(data) {
        const y = data.getFullYear();
        const d = String(data.getDate()).padStart(2, '0');
        const m = String(data.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Retorna o período do mês atual (1º ao último dia).
     */
    getPeriodoCorrente() {
        const hoje = new Date();
        const y = hoje.getFullYear();
        const m = hoje.getMonth();
        
        const inicio = new Date(y, m, 1);
        const fim = new Date(y, m + 1, 0);

        return {
            data_inicio: this._dateToStr(inicio),
            data_fim: this._dateToStr(fim),
            trecho_encontrado: "mês atual",
            excluir: false
        };
    }
}

module.exports = PeriodoService;