# Food Arena: pitch e primo mercato

## Pitch da 60 secondi

Ho dieci euro e mezz’ora per pranzare in Viale Pindaro. Su Food Arena pubblico questa richiesta e i locali propongono un piatto preciso. Il cliente sceglie, il locale prepara.

L’AI lavora nel browser del gestore: confronta le richieste con il menù e invia proposte autorizzate finché il pannello resta aperto.

Il gestore firma un mandato. Avalanche custodisce il budget di acquisizione e applica i limiti. La scelta riserva la commissione. Il ritiro attestato la assegna al beneficiario. Dopo la scadenza una transazione libera la riserva.

La demo usa test AVAX e locali fittizi. Il codice è pubblico MIT. Proponiamo due locali, dieci studenti e cinque giorni per verificare ritiri, lavoro del gestore e disponibilità a pagare.

## Perché un locale potrebbe provarlo

Il bisogno da verificare è concreto: ricevere richieste vicine che rispettano tempi, porzioni e prezzi già autorizzati, senza riscrivere ogni proposta. Il locale mantiene la decisione sul menù e il controllo del mandato. Il cliente sceglie fra offerte complete e paga il pranzo direttamente al locale.

La prova Fuji finanzia le commissioni dal budget intestato al firmatario del locale. Nella demo lo sponsor fornisce i token di prova. Una futura attività commerciale dovrebbe validare come il locale finanzia e recupera il proprio budget, oltre a supporto, no-show e gestione delle contestazioni.

## Primo canale e pilota

1. Reclutare direttamente due gestori nell’area di Viale Pindaro, verificando autorizzazione e disponibilità a dedicare poche porzioni a pranzo. Non sono partner già acquisiti.
2. Concordare piatti, prezzi completi, quantità e tempo massimo di preparazione. Fare un breve test del pannello con ciascun gestore.
3. Invitare dieci studenti tramite QR nei punti aderenti, soltanto dopo aver attivato disponibilità autentiche.
4. Provare per cinque giorni di pranzo. Registrare richieste, offerte compatibili, ritiri completati, ritardi e minuti di lavoro del gestore.
5. Intervistare entrambi i gestori su margine del pasto, sostenibilità dell’onere operativo e volontà di ripetere. Concordare prima eventuali soglie per continuare, senza presentarle come risultati già ottenuti.

## Chi paga e per cosa

Ipotesi da testare dopo il pilota: **0,30 € per ritiro completato, a carico del locale**, per l’acquisizione della richiesta e l’automazione della proposta. Tariffa non attiva. Nessun sovrapprezzo previsto per il cliente. I test AVAX della dimostrazione non rappresentano 0,30 € e non hanno un cambio impostato.

Oggi il progetto dichiara **zero partner aderenti e nessun ricavo verificato**. La priorità commerciale è verificare che la richiesta porti un ritiro incrementale e che il lavoro aggiuntivo resti sostenibile.

## Ruolo di AI e Avalanche

L’AI esegue confronto semantico e, se autorizzata, avvia offerte firmate. Le regole del prodotto controllano vincoli e disponibilità. L’autonomia attuale richiede pagina aperta e chiave locale disponibile.

Avalanche custodisce il budget e rifiuta spese incompatibili con firma, fondi e limiti. Il relayer inoltra le operazioni e paga il gas. Per i gestori registrati non possiede la chiave che autorizza Hold e Settlement. Nella prova relayer e beneficiario coincidono, ma il merchant è distinto. Le chiavi dei tre locali fittizi restano invece server-side, esclusivamente per rendere immediata la demo.

L’obiezione più forte è che un singolo intermediario potrebbe gestire un sistema analogo in un database. Il vantaggio da validare è consentire un budget verificabile e autorizzazioni applicabili anche a intermediari diversi. Nel prototipo l’accettazione dipende già dalla riserva confermata dal contratto. Questa integrazione dimostra il controllo economico; non dimostra ancora che i locali lo richiedano né risolve le contestazioni sulla consegna fisica.

## Prove da mostrare

[App](https://food-arena.eldamarchigiano.chatgpt.site), [mandato](https://food-arena.eldamarchigiano.chatgpt.site/mandato) e [GitHub](https://github.com/SPAZIOZEROLAB/food-arena). Il contratto ha superato tredici gruppi di test locali. La prova dell’app locale contro Fuji reale ha superato quaranta controlli: dodici scelte concorrenti producono una sola riserva, il ritiro un solo settlement e un solo decremento delle porzioni. Il test locale non attesta da solo il deploy pubblico. Per la demo pubblica usare gli esiti effettivi della pagina del mandato. [Report di integrazione](tests-budget-integration/README.md).
