# Food Arena

**Tu lanci il budget. I locali si fanno avanti.**

«Ho 10 € totali, sono in Viale Pindaro, ritiro entro mezz'ora». Food Arena trasforma questa richiesta in proposte precise: piatto, quantità, prezzo totale e orario. Il cliente sceglie e riceve un codice di ritiro. Il locale decide prezzi e disponibilità.

[Apri Food Arena](https://food-arena.eldamarchigiano.chatgpt.site) · [Demo guidata](docs/DEMO_WALKTHROUGH.md) · [Pitch e primo mercato](docs/PITCH_GTM.md) · [MIT](LICENSE)

## Prova subito, senza iscrizione

1. Lascia attiva **Arena demo**, con 10 €, una persona e ritiro entro 30 minuti.
2. Entra nell'arena: Verde, Bowl e Forno sono tre locali **fittizi**, con proposte dimostrative entro budget. Budget, quantità e filtro vegetariano possono ridurre il numero delle offerte.
3. Scegli prima che scada la proposta, ottieni il codice e simula il ritiro.
4. Registra l'impronta su Fuji e controlla la transazione nell'explorer.

La demo non prenota cibo e non applica pagamenti. Le tre proposte iniziali sono uno scenario predefinito. **Confronta con l'AI** esegue invece vera inferenza nel browser e riordina le offerte secondo la richiesta. I veri locali devono registrarsi, inserire disponibilità autentiche e autorizzare le proposte. Nessun partner o risultato commerciale è dichiarato.

## AI che risponde per il gestore

Il gestore accede al pannello e pubblica piatti, prezzi e quantità dedicate. Può chiedere un suggerimento oppure attivare **Rispondi automaticamente con l'AI**. A pagina aperta, ogni nuova richiesta compatibile viene confrontata semanticamente con il suo menù e il piatto selezionato viene proposto al cliente. L'invio automatico richiede l'autorizzazione del gestore.

Transformers.js 3.8.1 e MiniLM multilingue q8 eseguono l'inferenza nel browser, senza chiavi API. Primo download del modello circa 118 MB, poi cache. Regole separate verificano budget totale, quantità, zona, tempi e preferenza vegetariana. L'AI non inventa prodotti, prezzi o sconti e non certifica allergeni o tutti i vincoli in testo libero. A browser chiuso l'automazione si ferma; in errore resta possibile rispondere manualmente.

## Avalanche verificabile

Fuji C-Chain, **43113**. Contratto `PickupRegistryFuji`: `0xC423398Cb6208285f5B596b7d8b26A60748953c0`.

[Deploy confermato](https://subnets-test.avax.network/c-chain/tx/0x28690ea576672ac8c3b9de1be9d1b933eecd8da90995b6f57e0bd1f5379acdda) · [Ritiro dimostrativo dell'app registrato](https://subnets-test.avax.network/c-chain/tx/0x6466fe21a10289f9e04e51c45afc7f61b9205fea0ed7d7601eb1bded2cd4e3d2).

Il wallet di test **della piattaforma** firma due commitment; il contratto impedisce la riscrittura della stessa richiesta da parte dello stesso firmatario. La transazione rende verificabile l'attestazione pubblicata: non è un pagamento, una firma dell'esercente o una prova indipendente di consegna. Nessun dato personale o codice di ritiro viene pubblicato in chiaro. Il mercato funziona anche senza blockchain; oggi Avalanche aggiunge il registro di audit. Solo test AVAX, nessun fondo reale.

## Avvio locale

Node >=22.13; Vinext, React, TypeScript, Cloudflare Worker e D1. Dati condivisi nel database; cookie tecnico per il cliente, Sign in with ChatGPT per il gestore sul servizio ospitato. Il login va adattato su un altro host.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flaky_stature.sql
npm run dev
```

Applicare la migrazione una volta per database. Per Fuji configurare `FUJI_PRIVATE_KEY` come secret runtime usando esclusivamente un wallet di test; `.env.example` è vuoto. Non pubblicare chiavi, cookie o file `.env`. Limite applicativo: 50 nuove registrazioni Fuji al giorno. [Evidenze AI, API e Fuji](docs/proofs).

## Verifiche

[Stress test](docs/tests-stress/README.md): 50 richieste HTTP locali, picco 12 simultanee. Ultima porzione, scelta unica, doppio ritiro, proprietà della richiesta e scadenze controllate. [Arena demo](docs/tests-arena/README.md): 11 controlli su budget, quantità, vegetariano, tre zone, autorizzazione e ritiro unico. Questi sono test mirati del prototipo; non attestano capacità di traffico commerciale.

## Open source e origine

Codice del prodotto sviluppato con assistenza AI il **19 settembre 2026**, durante Team1 Hackathon. Starter, dipendenze e modello sono preesistenti e conservano le proprie licenze. Foto: Adedamola Oyenuga, [Pexels](https://www.pexels.com/photo/sandwich-on-yellow-surface-5006444/).

Licenza **MIT**, senza scadenza a tre mesi. Impegno del progetto: mantenere il repository sorgente pubblico almeno fino al **19 dicembre 2026**; il servizio ospitato dipende dalle risorse disponibili. Il vincolo dei tre mesi è stato riferito dalla partecipante, non riscontrato nelle linee guida pubbliche consultate.

Prima di un uso commerciale servono verifica dei locali, gestione assistenza e no-show, regole sui dati e validazione operativa. Nel pilota proposto si paga direttamente al locale; Food Arena non applica commissioni.
