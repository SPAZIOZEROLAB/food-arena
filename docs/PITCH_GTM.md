# Food Arena: il progetto e il primo mercato

[Presentazione PDF](Food-Arena-pitch-v4.pdf) · [PowerPoint modificabile](Food-Arena-pitch-v4.pptx) · [Guida per l’esposizione](GUIDA_PRESENTAZIONE.md)

## Il progetto in un minuto

Anna ha dieci euro e mezz’ora per pranzare in Viale Pindaro. Su Food Arena pubblica budget, zona e orario. I locali aderenti propongono piatti compatibili. Anna confronta le offerte e sceglie, senza pagare una quota aggiuntiva.

Luca, il gestore, decide menu, prezzi e quantità. Può rispondere personalmente oppure autorizzare l’AI a proporre per lui. Nel prototipo l’AI lavora mentre il pannello resta aperto.

Il budget del cliente paga il pranzo. Un budget diverso, autorizzato dal locale, serve a pagare il servizio di Food Arena. Un programma su Avalanche custodisce questa provvista e applica i limiti del gestore. Alla scelta mette da parte la commissione. Dopo la conferma firmata del ritiro la accredita una sola volta. Per un ritiro scaduto una transazione può liberare la somma.

La demo funziona su Avalanche Fuji con locali fittizi e gettoni di prova. Proponiamo di partire dalla pausa pranzo nella zona universitaria di Pescara, reclutando locali e clienti reali. Il codice è pubblico con licenza MIT.

## La scelta resta al cliente

L’arena raccoglie richieste e proposte compatibili. Il cliente può confrontare piatti, prezzi, distanza e tempi prima di scegliere. Una richiesta resta aperta fino alla scelta o alla scadenza. Non è un acquisto obbligatorio, una gara riservata a due locali o un servizio limitato ai gruppi. Il gestore offre soltanto ciò che può vendere alle condizioni autorizzate.

Il prodotto deve portare ordini convenienti e compatibili con la capacità del locale. Una vendita che sarebbe avvenuta comunque può aggiungere una commissione senza generare valore incrementale. La prova commerciale deve misurare questo effetto e il lavoro richiesto al gestore.

## Chi paga e per cosa

La proposta commerciale prevede ingresso e invio di offerte gratuiti per i locali, nessun canone e nessun sovrapprezzo per il cliente. Il locale pagherebbe **0,70 € per ritiro completato**, cioè **settanta centesimi**. Questa tariffa è un’ipotesi da validare, non è attiva.

Esempio: Anna paga 10 € al locale per il suo pranzo. Il locale sostiene separatamente 0,70 € per Food Arena. Un’eventuale provvista di 7 € coprirebbe dieci commissioni: è un esempio aritmetico del modello commerciale. Oggi il contratto custodisce esclusivamente test AVAX, finanziati dallo sponsor. Non esiste un cambio impostato con l’euro. Il versamento e il recupero di un budget in denaro reale non sono ancora implementati.

La proposta precedente di trenta centesimi è superata. Il prezzo va verificato rispetto al margine del locale, ai costi del servizio e alla disponibilità concreta a pagare. Una quota di 0,70 € non dimostra, da sola, un business sostenibile. Zero partner aderenti e nessun ricavo commerciale sono oggi dichiarati come verificati.

## Primo avvio proposto a Pescara

1. Reclutare direttamente locali nella stessa zona universitaria, verificando autorizzazione e disponibilità a proporre piatti a pranzo.
2. Concordare prezzi completi, quantità e tempi di preparazione. Provare il pannello con i gestori prima di invitare clienti.
3. Invitare studenti e lavoratori tramite i punti aderenti e canali concordati, dopo aver attivato disponibilità autentiche.
4. Misurare richieste, offerte ricevute, ritiri, tempi e lavoro del gestore. Distinguere nuovi ordini da vendite che sarebbero avvenute comunque.
5. Verificare ritorno dei clienti e volontà dei locali di proseguire alle condizioni economiche proposte. Registrare i costi effettivi prima di decidere l’espansione.

Si tratta di un percorso da organizzare, non di un test già realizzato. Una prima prova con pochi partecipanti può individuare problemi d’uso; non costituisce validazione del mercato. Il numero dei partecipanti al pilota non limita l’accesso futuro all’arena.

## Ruolo effettivo di AI e Avalanche

L’AI confronta semanticamente la richiesta con il menu del gestore. Le regole del prodotto controllano prezzo, quantità, zona e tempi. Con autorizzazione, chiave locale, budget disponibile e pannello aperto, l’AI invia offerte firmate. Non sono dichiarate notifiche push, funzionamento a pagina chiusa o comprensione garantita di ogni vincolo scritto liberamente.

Avalanche custodisce il budget e rifiuta operazioni incompatibili con firma, fondi e limiti. L’accettazione applicativa attende la riserva confermata dal contratto. Il cliente vede il codice di ritiro soltanto dopo quella conferma. Una seconda firma del gestore autorizza l’accredito; il credito è distinto dal successivo prelievo. Dopo la scadenza una transazione può liberare la riserva. Il semplice passare del tempo non invia una transazione.

Il relayer paga le transazioni e inoltra le autorizzazioni. Per i gestori registrati la chiave resta nel browser. Relayer e beneficiario coincidono nel prototipo; il firmatario del gestore è distinto. I tre locali fittizi della demo usano invece chiavi gestite dal server. Questa modalità permette una prova immediata e non dimostra indipendenza fra operatori.

Un servizio analogo potrebbe usare un intermediario centralizzato. Qui il contratto esegue custodia e autorizzazioni verificabili: è questo il ruolo concreto di Avalanche. La blockchain non osserva la consegna fisica del pasto, che resta attestata dal gestore, e non dimostra la domanda commerciale.

## Prove disponibili

[App](https://food-arena.eldamarchigiano.chatgpt.site) · [Mandato, saldi e transazioni](https://food-arena.eldamarchigiano.chatgpt.site/mandato) · [Repository](https://github.com/SPAZIOZEROLAB/food-arena)

Il contratto ha superato 13 gruppi di test locali. L’integrazione dell’app locale con Fuji reale ha superato 40 controlli, compresi dodici tentativi concorrenti con una sola scelta, riserva e conferma del ritiro. Le prove Fuji includono 14 verifiche. Sei test SQLite verificano query e riconciliazione. Questi controlli non sono un audit indipendente né una prova di redditività.

Il percorso del sito pubblico è stato verificato il 19 settembre 2026: [riserva confermata](https://build.avax.network/explorer/fuji/c-chain/tx/0x7897bea409a60ff1a766bd732f0e972c69e169d6db2a23023967cdedd0a3421d) e [regolamento confermato](https://build.avax.network/explorer/fuji/c-chain/tx/0x6bad20141e0519a895405fdf0a045db5ea7787574e6cad3dea876f9193517136). La pagina del mandato mostra le prove disponibili e gli eventuali stati pendenti. Non presentare uno stato pendente o un errore come un’operazione riuscita.
