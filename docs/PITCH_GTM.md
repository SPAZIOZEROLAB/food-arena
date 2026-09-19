# Food Arena — pitch e primo mercato

## Sessanta secondi

> Ho dieci euro e mezz'ora per pranzare in Viale Pindaro. Con Food Arena pubblico una richiesta: sono i locali a propormi cosa mangiare, a quale prezzo totale e quando ritirarlo. Scelgo e ricevo il codice per il banco. Il gestore carica ciò che può preparare e autorizza l'AI a rispondere alle richieste compatibili: il modello lavora nel suo browser, senza chiavi API, rispettando prezzi e quantità impostati. Su Avalanche Fuji registro un'impronta verificabile dell'attestazione di ritiro. È una transazione reale di test, non un pagamento né una prova della consegna fisica. La demo si prova subito con tre locali dichiaratamente fittizi. Il primo mercato è concreto: due locali, dieci studenti, cinque pranzi in Viale Pindaro. Misureremo ritiri, lavoro del gestore e disponibilità a pagare. Oggi il prototipo c'è; i clienti vanno conquistati.

## Il primo esperimento commerciale

**Una zona, una fascia oraria, un bisogno:** studenti e lavoratori che cercano un pranzo da ritirare vicino al campus, con budget e tempo già definiti.

| Passo proposto | Azione e prova da raccogliere |
|---|---|
| Prima del lancio | Ottenere il consenso di due locali; concordare 2–3 piatti, quantità dedicate, prezzi sostenibili e fasce di ritiro. Nessun locale risulta già aderente. |
| Primo canale | Reclutare di persona dieci studenti con un QR, nella zona servita e solo dopo avere disponibilità reali. |
| Cinque pranzi | Assistere gestori e studenti; misurare prima offerta, scelte, ritiri dichiarati, no-show e minuti aggiuntivi di lavoro. |
| Decisione | Obiettivi da verificare: almeno 6 studenti su 10 ritirano e tutti e due i locali vogliono ripetere. Chiedere se gli acquisti sarebbero avvenuti comunque nello stesso locale. |

**Chi paga:** ipotesi da validare, l'esercente per ricevere domanda qualificata e rispondere con meno lavoro. Il test è gratuito. Dopo, confrontare due formule alternative: **15 €/mese** oppure **0,30 € per ritiro registrato**, senza sommarle. A 50 ritiri mensili equivalgono; su 10 € la seconda vale il 3%. Non sono tariffe attive né ricavi ottenuti. Nessun sovrapprezzo automatico al cliente.

L'inferenza locale evita un costo API per richiesta; restano hosting, traffico del modello, supporto e acquisizione. La sostenibilità richiede margine del locale e riuso, non soltanto ordini conteggiati.

## Le prove da mostrare

La demo anonima prova richiesta, scelta, codice, ritiro simulato e registrazione Fuji. Le prime tre offerte sono predefinite. Per dimostrare l'AI, aprire il pannello gestore: modello caricato, confronto semantico eseguito e nuova proposta inviata dopo autorizzazione. Mostrare infine una transazione confermata, senza chiamarla pagamento.

**Obiezione decisiva:** i locali devono aggiornare le quantità e tenere aperto il pannello. Se il lavoro aggiuntivo supera gli ordini ottenuti, il pilota fallisce. La risposta è misurarlo con due attività prima di espandere la zona.

**Ruolo attuale di Avalanche:** registro esterno consultabile delle attestazioni della piattaforma, con divieto di sovrascrittura. La sua utilità per riconciliazioni fra soggetti diversi resta da validare; il prototipo non dimostra che la blockchain sia indispensabile al mercato.
