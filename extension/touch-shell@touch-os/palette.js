// Palette di Touch OS: la fonte unica dei colori di tutto il progetto (tema Shell, GTK3, GTK4,
// pannello impostazioni, banco di prova).
//
// Nome in codice «Ink & Iris»: di notte un inchiostro blu-nero con superfici che si schiariscono a gradini,
// di giorno una nuvola fredda con carte bianche. Un solo colore segnale (l'accento) per ciò che è attivo;
// gli altri cinque sono alternative. I grigi hanno una punta di blu: sono più morbidi di un grigio neutro
// e non "sporcano" accenti caldi come corallo o ambra.
//
// L'elevazione conta: i livelli salgono di luminosità (view < bg < surface < dialog < raised) e le cose che
// galleggiano hanno un'ombra morbida (token `shade`).
//
// Non importa nulla della Shell: gira in qualunque processo gjs.

/** Grigi e testo: cambiano con lo schema, non con l'accento. */
export const NEUTRALS = {
    dark: {
        bg: '#15161d',          // sfondo della finestra
        view: '#111218',        // fondo di liste e testo: un pozzetto appena più scuro della finestra
        sidebar: '#101117',     // barre laterali: un gradino sotto
        dialog: '#1f212b',      // dialoghi e popover: una superficie rialzata
        deep: '#0b0c10',        // il più scuro: velo, pozzetti, testo sull'accento chiaro
        sunken: '#1a1b24',      // incavi (calendario, sottomenu)
        field: '#252734',       // campi di testo, interruttori spenti, segmenti: pieni, senza bordo
        surface: '#1e2029',     // carte e righe di lista
        raised: '#2a2d3b',      // premuto / sopra una carta
        key: '#2c2f3e',         // tasti della tastiera su schermo (lettere)
        key2: '#1f212c',        // … e tasti di funzione (maiuscole, invio, ?123)
        outline: '#363a4d',     // filetto forte (pochi: i bordi sono l'eccezione, non la regola)
        line: '#272a39',        // filetto tenue, separatori
        fg: '#f3f4f9',          // testo
        fg2: '#b2b7c8',
        fg3: '#8b91a8',
        fg4: '#656b82',
        shade: '#000000',       // colore delle ombre
        red: '#ff6f80',
        green: '#5fd39b',
        amber: '#ffb94f',
        blue: '#6cabff',
        rose: '#ff7eaa',
    },
    light: {
        bg: '#f3f4f9',
        view: '#ffffff',
        sidebar: '#eceef6',
        dialog: '#ffffff',
        deep: '#e3e6f0',
        sunken: '#e9ebf4',
        field: '#e7e9f3',
        surface: '#ffffff',
        raised: '#e4e7f1',
        key: '#ffffff',
        key2: '#dde0ec',
        outline: '#cdd1e1',
        line: '#e0e3ee',
        fg: '#171923',
        fg2: '#535970',
        fg3: '#646a84',
        fg4: '#979db2',
        shade: '#1c2347',
        red: '#c92a3c',
        green: '#1d7d53',
        amber: '#9c5f00',
        blue: '#1b5fc4',
        rose: '#bb2a63',
    },
};

/**
 * Colori «segnale». L'iris è il marchio; gli altri sono alternative.
 * `hi` = luce/hover, `lo` = premuto, `on` = testo sopra l'accento, `soft` = fondo tenue.
 */
export const ACCENTS = {
    iris: {
        dark:  {accent: '#8f9bff', hi: '#a8b2ff', lo: '#7581f0', on: '#0c0f33', soft: '#2b3070'},
        light: {accent: '#4756e0', hi: '#5b6af0', lo: '#3a47c2', on: '#ffffff', soft: '#e0e3ff'},
    },
    sky: {
        dark:  {accent: '#5db6ff', hi: '#7cc4ff', lo: '#47a0ec', on: '#031a30', soft: '#173a5c'},
        light: {accent: '#1a69c9', hi: '#2a7ade', lo: '#1356a8', on: '#ffffff', soft: '#d6e8fb'},
    },
    mint: {
        dark:  {accent: '#4fdcb0', hi: '#6ae6c0', lo: '#3cc298', on: '#032419', soft: '#144a3b'},
        light: {accent: '#0f7a5c', hi: '#198d6b', lo: '#0b6249', on: '#ffffff', soft: '#d3f3e8'},
    },
    coral: {
        dark:  {accent: '#ff8b7b', hi: '#ffa092', lo: '#ec7262', on: '#2e0a05', soft: '#5c241c'},
        light: {accent: '#c8432f', hi: '#da5640', lo: '#a93624', on: '#ffffff', soft: '#ffe0da'},
    },
    amber: {
        dark:  {accent: '#ffc15a', hi: '#ffce7c', lo: '#ecab3f', on: '#2a1c00', soft: '#54400f'},
        light: {accent: '#8f5a00', hi: '#a26a0a', lo: '#774a00', on: '#ffffff', soft: '#fbe9c3'},
    },
    rose: {
        dark:  {accent: '#ff80b2', hi: '#ff9ac3', lo: '#ec6699', on: '#33061b', soft: '#5c1f3a'},
        light: {accent: '#b8235f', hi: '#cc3472', lo: '#9c1b4f', on: '#ffffff', soft: '#ffd9e8'},
    },
};

export const ACCENT_NAMES = Object.keys(ACCENTS);

/**
 * Palette ANSI a 16 colori per terminali ed editor. Il rosso/verde/blu sono quelli semantici del tema;
 * il magenta è un viola vicino all'iris; il ciano è la media tra blu e verde.
 */
export const ANSI = {
    dark: ['#15161d', '#ff6f80', '#5fd39b', '#f2c16b', '#6cabff', '#c79bff', '#5ed6d6', '#b2b7c8',
        '#363a4d', '#ff909d', '#86e3b6', '#ffd68a', '#8fc0ff', '#d9b8ff', '#86e6e6', '#f3f4f9'],
    light: ['#171923', '#c92a3c', '#1d7d53', '#8f5a00', '#1b5fc4', '#7a3fd1', '#0f7a82', '#535970',
        '#979db2', '#dc3c4e', '#2a9468', '#a8700f', '#2f75dc', '#9055e3', '#1b8e96', '#2a2d3a'],
};

/** Palette completa (neutri + accento) per uno schema. Restituisce {token: '#rrggbb'}. */
export function palette(scheme = 'dark', accent = 'iris') {
    const a = (ACCENTS[accent] ?? ACCENTS.iris)[scheme === 'light' ? 'light' : 'dark'];
    return {...NEUTRALS[scheme === 'light' ? 'light' : 'dark'], ...a};
}

/** '#rrggbb' → [r, g, b] */
export function rgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

/** '#rrggbb' + 0..1 → 'rgba(r, g, b, a)' */
export function rgba(hex, alpha) {
    const [r, g, b] = rgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
}

/** Mescola due colori: t = 0 → a, t = 1 → b. */
export function mix(a, b, t) {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}
