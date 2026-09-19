# Food Arena: demo del mandato

[Apri Food Arena](https://food-arena.eldamarchigiano.chatgpt.site) · [Mandato e prove](https://food-arena.eldamarchigiano.chatgpt.site/mandato)

## Cliente, senza iscrizione

1. Lascia attiva **Arena demo**. Imposta 10 €, una persona, Viale Pindaro e ritiro entro 30 minuti.
2. Entra nell’arena. Forno, Verde e Bowl sono locali fittizi. In questo scenario le offerte dimostrative costano 7,90 €, 8,50 € e 9,90 €. Non sono partner o disponibilità autentiche.
3. Usa **Confronta con l’AI** per eseguire il confronto semantico nel browser. Il primo caricamento del modello può richiedere tempo. Le offerte iniziali restano uno scenario predefinito.
4. Scegli una proposta. Attendi la conferma della riserva su Fuji. Durante l’operazione pendente non presentare il ritiro come già confermato.
5. Dopo la conferma, visualizza il codice. Usa il comando dimostrativo di ritiro previsto dall’app e attendi il settlement. Il server firma per il locale fittizio. Nessun pasto o pagamento reale.
6. Apri il link della transazione e controlla rete 43113, contratto, esito e stato dell’ordine. Il budget riservato diminuisce e matura un credito per il beneficiario. Il credito non coincide con una riscossione già eseguita.

## Gestore con chiave nel browser

1. Accedi al pannello gestore e crea un banco di prova, oppure un punto che sei autorizzato a gestire.
2. Premi **Attiva mandato di prova**. Il browser genera una nuova chiave Fuji e firma configurazione e collegamento al locale. La chiave resta nel browser. Usa solo la chiave di prova generata qui.
3. Se il mandato è pendente, attendi e premi **Completa attivazione**. Configurazione e finanziamento possono richiedere passaggi distinti. Non creare un altro wallet per aggirare l’attesa.
4. Pubblica piatti e quantità. Proponi manualmente oppure attiva le risposte AI. Serve budget disponibile. Il browser firma l’Hold per il piatto selezionato e l’automazione richiede pannello aperto.
5. Dal lato cliente scegli la proposta. Attendi la riserva confermata prima di preparare un ritiro confermato.
6. Nel pannello gestore inserisci il codice mostrato dal cliente e premi **Firma e conferma ritiro**. Il browser firma un Settlement distinto. Attendi l’esito Fuji e apri il link effettivo della transazione.

## Scadenza su un altro ordine

Per mostrare il rilascio usa **un secondo ordine**, accettato e rimasto senza ritiro fino alla scadenza. Nella scheda del gestore premi **Libera commissione scaduta** quando disponibile. Il rilascio richiede una transazione: il solo trascorrere del tempo non modifica i saldi onchain. Dopo la conferma, la somma ritorna disponibile e nessuna commissione matura per quell’ordine.

Non raccontare settlement e rilascio come esiti dello stesso ordine. Non modificare l’orologio né inventare un hash per abbreviare la presentazione. Se il tempo della demo non permette una scadenza completa, mostra una prova già verificata nella pagina del mandato e dichiarala come tale.

## Che cosa dimostra la prova

- **AI:** confronto semantico effettivo e invio di proposte autorizzate nel browser del gestore.
- **Contratto:** custodia, firma EIP-712, beneficiario vincolato, limite per ordine e complessivo, riserva, settlement distinto e rilascio dopo scadenza.
- **Limite:** il gestore dichiara il ritiro. Il contratto non osserva la consegna fisica e non incassa il prezzo del pranzo.
- **Ruoli:** gestore registrato con chiave nel proprio browser. Nella demo anonima i firmatari dei locali fittizi sono server-side. Relayer e beneficiario coincidono nel prototipo, mentre il merchant è distinto.
- **Fondi:** esclusivamente test AVAX, finanziati dallo sponsor nella prova. Nessun cambio con euro e nessun fondo reale.

Il report del contratto contiene **13 gruppi di test locali Ganache superati**. Inoltre l’app locale collegata a Fuji reale ha superato 40 controlli HTTP/onchain, con una sola riserva e un solo settlement anche con dodici chiamate concorrenti. Queste evidenze non attestano da sole il deploy pubblico. [Report di integrazione](tests-budget-integration/README.md). Se la pagina del mandato mostra dati mancanti, errore o operazioni pendenti, dichiarare quello stato e usare soltanto le prove disponibili.
