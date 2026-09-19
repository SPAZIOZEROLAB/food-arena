# Verifica nel browser del gestore e del cliente

19 settembre 2026, circa 14:47–14:52 Europe/Rome. App locale collegata al contratto Fuji pubblicato. Controlli eseguiti attraverso l’interfaccia; nessun inserimento di header di autenticazione, accesso alle chiavi o modifica al database.

1. Accesso tramite il normale login locale al banco dimostrativo esistente. Attivazione esplicita del mandato: wallet di prova creato nel browser, firma del mandato e finanziamento di 0,002 test AVAX. Il pannello passa da «Da attivare» a «Mandato attivo».
2. Attivata l’opzione «Rispondi automaticamente con l’AI». Dal cliente viene pubblicata una richiesta demo da 10 euro: «Vorrei una piadina con verdure grigliate e acqua».
3. Il pannello mostra inferenza locale in 114 ms per questa singola esecuzione e l’invio della proposta. Il cliente riceve «Piadina alle verdure + acqua», totale 9,50 euro, come quarta offerta oltre alle tre fittizie predefinite. Non è una misura generale delle prestazioni.
4. Il cliente sceglie la proposta. Dopo la conferma Fuji compaiono codice e riserva: 0,0019 disponibile, 0,0001 riservato. [Hold](https://build.avax.network/explorer/fuji/c-chain/tx/0x4943c2f29be6014236e95c8505b46021f53c27257fef529fd56f358862d47f67).
5. Il codice viene inserito nel pannello del gestore, premendo «Firma e conferma ritiro». Il cliente vede «Prova completata», riserva zero e 0,0001 regolato. [Settlement](https://build.avax.network/explorer/fuji/c-chain/tx/0x4c4cf4ebd5a9931d78a82382139f8d17f36842c925bb4ffa848b8594c343b41f).
6. Verifica visiva a 390 × 844 del ritiro e della pagina `/mandato`: testo e azioni leggibili, nessuno scorrimento orizzontale. La pagina mostra «Prove disponibili» e 14/14 verifiche Fuji superate. Vista ripristinata al termine.

Il banco e il pasto sono dimostrativi. La firma separata è effettivamente prodotta dal browser del gestore; questa prova non attesta adesione di un ristorante o una consegna fisica.
