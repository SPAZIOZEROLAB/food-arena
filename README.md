# Food Arena

**Tu lanci il budget. I locali propongono il pranzo.**

«Ho 10 € totali, sono in Viale Pindaro e ritiro entro mezz’ora». Il cliente pubblica la richiesta e confronta le offerte compatibili dei locali aderenti. Ogni proposta indica piatto, quantità, prezzo totale e tempo di preparazione. La richiesta resta aperta fino alla scelta o alla scadenza. Il cliente sceglie liberamente e può anche non acquistare.

Il gestore decide menu, prezzi e quantità. Può proporre personalmente oppure autorizzare l’AI a rispondere entro quei limiti. Alla scelta del cliente, Avalanche riserva la commissione dal budget del locale. Quando il gestore conferma il ritiro con una firma, il contratto accredita il servizio una sola volta.

[Apri l’app](https://food-arena.eldamarchigiano.chatgpt.site) · [Mandato e prove Fuji](https://food-arena.eldamarchigiano.chatgpt.site/mandato) · [Demo guidata](docs/DEMO_WALKTHROUGH.md) · [Pitch e primo mercato](docs/PITCH_GTM.md)

**Presentazione corrente:** [PDF, 8 slide](docs/Food-Arena-pitch-v4.pdf) e [PowerPoint modificabile](docs/Food-Arena-pitch-v4.pptx). [Guida per raccontare il progetto](docs/GUIDA_PRESENTAZIONE.md). Le presentazioni v2 e v3 restano come archivio e contengono proposte commerciali precedenti.

## Chi paga il servizio

Il modello commerciale proposto prevede cliente senza sovrapprezzo e locale senza canone, costo di ingresso o costo per l’invio di una proposta. Il locale pagherebbe **0,70 € — settanta centesimi — per ogni ritiro completato**. È una tariffa da validare con i gestori, non un addebito attivo né una prova di redditività.

Esempio commerciale: il cliente paga 10 € al locale per il pranzo. Il locale sostiene separatamente 0,70 € per Food Arena. Il budget custodito nel contratto serve a finanziare le commissioni del locale; è distinto dal denaro con cui il cliente paga il cibo. La demo usa soltanto gettoni di prova finanziati dallo sponsor. Non incassa euro e non converte test AVAX nella tariffa proposta.

## Due modi per provare

**Arena demo, senza iscrizione.** Con 10 €, una persona e 30 minuti compaiono tre locali fittizi: Forno, Verde e Bowl, con piatti dimostrativi da 7,90 €, 8,50 € e 9,90 €. Quantità, budget e filtro vegetariano possono ridurre le proposte. Si può scegliere e provare il percorso di ritiro, senza prenotare cibo. Queste offerte iniziali sono predefinite. I loro firmatari di test sono gestiti dal server e non rappresentano esercenti indipendenti.

**Pannello gestore.** Il gestore accede, crea il punto e inserisce un menù. Premendo **Attiva mandato di prova** genera una chiave esclusivamente Fuji nel proprio browser. La chiave resta lì, anche dopo il ricaricamento, e non viene inviata al server. Il mandato richiede una firma EIP-712 e una firma che associa quel wallet al locale. Se si cambia browser senza quella chiave, il pannello non crea automaticamente un altro mandato. Nella prova lo sponsor versa i token nel budget del gestore.

## AI che opera sulle richieste

Il gestore può chiedere un suggerimento oppure attivare le risposte automatiche. Con il pannello aperto, MiniLM multilingue confronta ogni richiesta compatibile con il menù e propone un piatto autorizzato. Il browser firma l’offerta. L’automazione richiede mandato configurato, chiave locale corrispondente e budget disponibile.

Transformers.js esegue l’inferenza nel browser senza API key. Il primo download del modello è circa 118 MB, poi interviene la cache. Anche il cliente può ordinare le offerte per affinità. Regole separate controllano prezzo, disponibilità, quantità, zona e tempi. Il modello non certifica allergeni o tutti i vincoli scritti liberamente. A pannello chiuso l’automazione si ferma.

## Perché Avalanche è nel percorso economico

`FoodArenaBudgetFuji` custodisce **test AVAX** sulla C-Chain Fuji, chain ID **43113**. Il mandato autorizza un beneficiario, un limite per ordine e un limite complessivo. Il contratto verifica le firme e rifiuta una riserva che supera fondi o limiti.

1. Il cliente sceglie una proposta. L’app invia l’Hold firmato dal gestore e attende conferma della riserva.
2. Al ritiro, il gestore controlla il codice e firma un Settlement distinto. Il contratto accredita il beneficiario. Il credito maturato è distinto dalla sua riscossione.
3. Se il ritiro scade, una transazione di rilascio restituisce la riserva al budget disponibile. La scadenza da sola non esegue una transazione.

Il relayer paga il gas e inoltra autorizzazioni firmate. Non possiede la chiave del gestore registrato e non può cambiare importo, termini o beneficiario della sua firma. Nel prototipo relayer e beneficiario coincidono, mentre il firmatario del gestore è distinto. Nei tre locali fittizi la piattaforma controlla anche le chiavi demo: questa modalità non prova indipendenza fra operatori.

L’accettazione applicativa attende lo stato del contratto: senza riserva confermata non diventa un ritiro confermato. Resta una scelta architetturale da validare con esercenti reali, non una prova di domanda commerciale. La blockchain controlla custodia e autorizzazioni; il ritiro fisico resta una dichiarazione del gestore. Nessun codice di ritiro o dato personale compare in chiaro onchain.

**Nessun fondo reale. Il pasto si paga al locale, senza sovrapprezzo al cliente.** I token Fuji non hanno una conversione nella tariffa ipotetica di 0,70 € per ritiro. Il finanziamento e il recupero del budget con denaro reale richiedono un percorso commerciale ancora da realizzare.

## Prove e limiti

La [pagina del mandato](https://food-arena.eldamarchigiano.chatgpt.site/mandato) mostra contratto, indirizzi, saldi e link effettivamente disponibili. Uno stato pendente o assente non equivale a una transazione riuscita. Le vecchie ricevute `PickupRegistryFuji` documentano una versione precedente e non provano il nuovo escrow.

Il contratto ha superato **13 gruppi di test locali Ganache**: firme e dominio, replay, beneficiario, fondi insufficienti, concorrenza, limiti, settlement, rilascio, prelievo e claim. Il risultato è nel report del contratto. È una verifica locale del prototipo, non un audit indipendente.

L’integrazione dell’app locale con Fuji reale ha inoltre superato **40 controlli HTTP e onchain** il 19 settembre 2026: dodici accettazioni concorrenti producono una sola scelta e un solo Hold. Il ritiro produce un solo Settlement e decrementa una sola volta le porzioni. Questo test riguarda il server locale collegato a Fuji, non attesta da solo il deploy pubblico. [Report di integrazione](docs/tests-budget-integration/README.md).

Contratto: [`0x1077e1317345de42af33B0E048bC2cD725Cf9fC5`](https://build.avax.network/explorer/fuji/c-chain/address/0x1077e1317345de42af33B0E048bC2cD725Cf9fC5). [Hold dall’app](https://build.avax.network/explorer/fuji/c-chain/tx/0x1df59597405b744d79a0df85502cb8827795037f64eda6ec0a2048dfc2773ee0), [Settlement dall’app](https://build.avax.network/explorer/fuji/c-chain/tx/0x4ae6a851504d4ec823c290acc08d17f551a9db4346209f7da90776f219fcf849) e [rilascio per scadenza su un altro ordine di prova](https://build.avax.network/explorer/fuji/c-chain/tx/0x684bef69dd96fc9c84c0816a40cf840e47b3b12a1acfb8d9dbd40523934f33be).

## Avvio e configurazione

Node >=22.13, React, TypeScript, Vinext, Cloudflare Worker e D1. Installare con `npm ci`, compilare con `npm run build`, applicare nell’ordine le migrazioni D1 presenti in `drizzle`, poi avviare con `npm run dev`. Il login del gestore usa Sign in with ChatGPT sul servizio ospitato e va adattato su un altro host.

Il contratto e l’ABI sono nel repository. `app/budget-config.ts` definisce rete, indirizzo e limiti della prova. `FUJI_PRIVATE_KEY` è un secret runtime del solo sponsor/relayer: usare esclusivamente una chiave di test. Le chiavi dei gestori registrati restano nei rispettivi browser. Non pubblicare file `.env`, chiavi o cookie. Le dipendenze e le condizioni d’uso del modello conservano le loro licenze.

## Pilota e licenza

Il primo mercato proposto è la pausa pranzo nella zona universitaria di Pescara. Occorre reclutare locali vicini con disponibilità autentiche, concordare piatti e orari, e invitare clienti a provare richieste reali. Il numero di locali nella demo non limita l’arena. Una prima prova serve a correggere il percorso; una sperimentazione più ampia deve misurare ritiri aggiuntivi, ritorno dei clienti, lavoro del gestore e disponibilità a pagare. Nessun pilota, partner aderente o ricavo è dichiarato come già ottenuto. La tariffa proposta di 0,70 € resta da validare.

Codice del prodotto sviluppato con assistenza AI il **19 settembre 2026**, durante Team1 Hackathon. Starter e modello preesistenti sono dichiarati. Foto dell’app: Adedamola Oyenuga, [Pexels](https://www.pexels.com/photo/sandwich-on-yellow-surface-5006444/).

Licenza **MIT senza scadenza**. Impegno del progetto: mantenere il sorgente pubblico almeno fino al **19 dicembre 2026**. La continuità del servizio ospitato dipende dalle risorse disponibili. Il termine dei tre mesi è stato riferito dalla partecipante, non riscontrato nelle linee guida pubbliche consultate.
