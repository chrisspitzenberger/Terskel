# Laktatschwellen-Berechnung in Terskel

Die Terskel-App nutzt moderne, sportwissenschaftlich validierte Methoden zur Bestimmung der Laktatschwellen (LT1 und LT2). Anstatt sich nur auf feste (oft ungenaue) Werte zu verlassen, analysiert die App die individuelle Laktatkinetik (die Kurvenform) des Athleten.

Hier ist im Detail dokumentiert, wie und wann die App welche Berechnungsmethode anwendet.

---

## 1. Kurvenanpassung (Curve Fitting)

Bevor Schwellen ermittelt werden können, muss aus den einzelnen Messpunkten des Stufentests eine kontinuierliche Kurve gebildet werden. 

Die App wendet folgende Methoden an (in absteigender Priorität):

1. **Polynom 3. Grades (Primäre Methode):**
   - **Formel:** `La(v) = a·v³ + b·v² + c·v + d`
   - **Wann es genutzt wird:** Dies ist der Standard. Es wird genutzt, wenn das Bestimmtheitsmaß ($R^2$) mindestens `0.90` beträgt und die Kurve physiologisch plausibel ist (sie muss bei höheren Geschwindigkeiten ansteigen).
   - **Warum:** Polynome 3. Grades modellieren den typischen Laktatverlauf (erst flach, dann exponentiell ansteigend) für die meisten Athleten am besten.

2. **Exponentialfunktion (Fallback):**
   - **Formel:** `La(v) = a + b·e^(c·(v − v_ref))`
   - **Wann es genutzt wird:** Wenn das Polynom fehlschlägt (z. B. $R^2 < 0.90$ oder die Kurve sinkt am Ende ab).
   - **Wie gefittet wird:** Bei festem Wachstumsparameter `c` ist das Modell linear in `a` und `b`. Die App tastet `c` über ein Raster ab und löst `a` und `b` je Kandidat exakt per kleinster Quadrate. Das ist deutlich robuster als ein iteratives Gradientenverfahren, das bei so wenigen Datenpunkten oft gar nicht konvergiert.
   - **Warum:** Eine Exponentialkurve erzwingt einen Anstieg und ist robuster bei "unsauberen" Daten, fittet aber manchmal im unteren Bereich nicht ganz so genau wie das Polynom.

Die im Diagramm gezeichnete Kurve stammt aus **derselben** Anpassung wie die Schwellenberechnung. Kurve und LT1/LT2-Marker können daher nicht auseinanderlaufen.

---

## 2. LT1: Aerobe Schwelle (Erster Laktatanstieg)

Die LT1 markiert den Übergang vom rein aeroben Fettstoffwechsel zum moderaten Kohlenhydratstoffwechsel. Hier beginnt das Laktat erstmals leicht zu steigen.

1. **Baseline + 0.4 mmol/L auf der gefitteten Kurve (Norwegisches Modell, Primär):**
   - **Wie es funktioniert:** Die App sucht den niedrigsten unter Belastung gemessenen Laktatwert (die Baseline). Die LT1 wird dort gesetzt, wo die gefittete Kurve den Wert `Baseline + 0.4` erreicht.
   - **Wichtig – der Laktat-Dip:** Auf der ersten Stufe ist Laktat durch das Aufwärmen häufig erhöht und sinkt danach zunächst ab. Die App bestimmt deshalb zuerst das Minimum der Kurve und sucht den Schwellendurchgang **erst ab dort aufwärts**. Nur der *ansteigende* Durchgang markiert LT1. Ohne diese Einschränkung würde ein erhöhter Startwert die LT1 auf die langsamste Stufe ziehen.
   - **Ruhelaktat:** Ein separat erfasstes Ruhelaktat geht bewusst **nicht** in die Baseline ein. Es liegt regelmäßig unter allem, was im Test erreicht wird, und würde die LT1 systematisch zu langsameren Tempi verschieben. Weicht es stark vom niedrigsten Belastungswert ab, gibt es stattdessen eine Warnung.

2. **Log-Log Breakpoint Methode (Fallback):**
   - **Wie es funktioniert:** Die App wandelt Geschwindigkeit und Laktat auf eine logarithmische Skala um. Dann sucht sie nach einem "Knick" (Breakpoint) in den Daten, indem sie zwei gerade Linien (lineare Regressionen) an die Datenpunkte anpasst. Der Punkt, an dem der Gesamtfehler beider Linien am geringsten ist, ist die LT1.
   - **Wann es genutzt wird:** Wenn keine gültige Kurvenanpassung vorliegt. Das Ergebnis wird geprüft (darf nicht zu nah am Testende liegen, Laktat muss < 2.5 mmol/L sein); fällt es durch, greift eine lineare Interpolation zwischen den Messpunkten.

---

## 3. LT2: Anaerobe Schwelle (MLSS / ANS)

Die LT2 (oft Anaerobe Schwelle genannt) ist das Maximum Lactate Steady State (MLSS). Es ist die höchste Intensität, bei der Laktatproduktion und Laktatabbau noch im Gleichgewicht sind.

1. **ModDmax-Methode (Modifiziertes Dmax, Primär):**
   - **Wie es funktioniert:**
     1. Es wird eine gerade Linie (Sekante) vom *LT1-Punkt* zum *letzten* Messpunkt gezogen. Genau das unterscheidet ModDmax vom klassischen Dmax, das beim ersten Messpunkt ansetzt.
     2. Die App sucht auf der berechneten Kurve (Polynom oder Exponential) genau den Punkt, der den **größten senkrechten Abstand** zu dieser Linie hat.
   - **Nur unterhalb der Sekante:** Eine Laktatkurve ist zwischen den beiden Sekanten-Endpunkten konvex, verläuft also *unterhalb* der Sekante. Die Suche ist auf diese Seite beschränkt. Andernfalls kann ein Rest des Aufwärmlaktats direkt neben LT1 als Punkt maximaler Krümmung missdeutet werden – die LT2 fiele dann praktisch mit der LT1 zusammen.
   - **Wann es genutzt wird:** Dies ist der absolute Goldstandard der App und wird immer verwendet, wenn eine gültige Kurve (Polynom oder Exponential) vorliegt.
   - **Warum:** Studien zeigen, dass das ModDmax-Verfahren die genaueste Vorhersage für das tatsächliche MLSS und die Wettkampfleistung liefert, da es die gesamte, individuelle Kurvenform des Athleten berücksichtigt.

2. **OBLA / Fixwert-Methode 4.0 mmol/L (Absoluter Notfall-Fallback):**
   - **Wie es funktioniert:** Die Schwelle wird fix bei einem Laktatwert von `4.0 mmol/L` gesetzt (Onset of Blood Lactate Accumulation nach Sjödin & Jacobs).
   - **Wann es genutzt wird:** NUR, wenn die Kurvenanpassung völlig fehlschlägt (z.B. bei extrem sprunghaften Datenfehlern) oder wenn die ModDmax-Methode geometrisch unmöglich ist (z.B. LT2 berechnet sich fälschlicherweise auf ein langsameres Tempo als LT1).
   - **Warum:** Der fixe Wert von 4.0 mmol/L ist individuell oft sehr ungenau (einige Profis haben ihr MLSS bei 2.5 mmol/L, andere bei 5.5 mmol/L). Er dient daher hier nur als letzte Rettung, damit die App nicht abstürzt.

---

## 4. Trainingszonen

Die fünf Zonen werden aus LT1 und LT2 abgeleitet und **teilen sich ihre Grenzen** – sie decken den gesamten Bereich lückenlos ab. Insbesondere ist der Bereich *zwischen* den beiden Schwellen vollständig der GA2-Zone (Z3) zugeordnet.

| Zone | Bereich (Tempo) |
|---|---|
| Z1 REKOM/LDL | LT1 + 75 s bis LT1 + 20 s |
| Z2 GA1 | LT1 + 20 s bis LT1 + 5 s |
| Z3 GA2 | LT1 + 5 s bis LT2 + 12 s |
| Z4 TDL | LT2 + 12 s bis LT2 − 5 s |
| Z5 WSA | LT2 − 5 s bis LT2 − 30 s |

Die zu jeder Zone angezeigten **Laktat- und Herzfrequenzbereiche** werden aus den tatsächlich gemessenen Schwellenwerten des Athleten abgeleitet, nicht aus einer festen Tabelle. Sie können den angezeigten Schwellen dadurch nicht widersprechen. Liegen LT1 und LT2 sehr nah beieinander, werden die Grenzen so korrigiert, dass keine Zone in sich verdreht.

---

## 5. Wettkampfprognosen

Grundlage ist die Annahme, dass die **LT2 näherungsweise der über 60 Minuten haltbaren Leistung** entspricht. Von diesem Referenzpunkt rechnet die App mit der Ausdauerformel nach Riegel auf andere Distanzen um:

```
t(d) = 3600 s · (d / d_60min)^k
```

- `k = 1.06` für Distanzen bis Halbmarathon (der von Riegel empirisch bestimmte Wert)
- `k = 1.07` für den Marathon, da dort zusätzlich die Glykogenverfügbarkeit limitiert – ein Faktor, den die Laktatkurve nicht abbildet

**Warum kein fester Prozentsatz:** Früher wurde die LT2-*Geschwindigkeit* mit festen Faktoren multipliziert (z. B. 85 % für den Marathon). Das unterstellt einen proportionalen Leistungsabfall, tatsächlich folgt er aber einem Potenzgesetz. Der Fehler wuchs dadurch systematisch mit der Distanz und lag beim Marathon langsamerer Läufer bei bis zu 45 Minuten.

Die Prognosen decken sich für 5 km und 10 km eng mit Daniels' VDOT-Äquivalenzen. Die Marathonzeit ist als physiologisches Potenzial zu verstehen und setzt entsprechendes Umfangstraining voraus.

---

## Zusammenfassung der Validierungen

Die App rechnet nicht blind, sondern prüft die Ergebnisse auf Plausibilität:
- Es müssen mindestens 3 Messpunkte vorliegen (unter 5 Messpunkten gibt es eine Warnung).
- Das maximale Laktat sollte über 4.0 mmol/L liegen, sonst ist der Test eigentlich nicht voll ausbelastet.
- Ein anfänglicher Laktat-Dip ist **normal und erlaubt**. Als „Anstieg begonnen" gilt erst, was *nach dem Minimum der Messreihe* passiert – nicht das Überschreiten eines festen Werts und auch nicht eine feste Stufennummer. Ein Verlauf wie 2.1 → 2.1 → 1.7 ist damit unauffällig, ein Einbruch von 2.8 → 1.9 mitten im Anstieg dagegen nicht.
- **LT2 muss zwingend schneller sein als LT1.** Ist dies nicht der Fall, greifen die oben beschriebenen Fallback-Methoden.
- LT1 und LT2 dürfen nicht zu nah beieinander liegen (mindestens 5 % der Geschwindigkeitsspanne des Tests).
- Liegt LT1 auf der langsamsten oder LT2 auf der schnellsten Stufe, wird gewarnt – der Test war dann vermutlich zu intensiv gestartet bzw. zu früh beendet. Solche Ergebnisse werden nicht mehr mit hoher Genauigkeit ausgewiesen.
