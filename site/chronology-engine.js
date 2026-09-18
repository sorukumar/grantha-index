/**
 * Chronology Engine
 * 
 * This module encapsulates all the logic for dynamic timeline generation,
 * including mathematical interpolation of missing alternative dates and bucket assignments.
 * Keep this decoupled from the UI rendering logic in index.html.
 */

// 1. Bucket Configurations
function getBucketsForMode(mode) {
    if (mode === 'alternative') {
        return [
            { label: "Before 10,000 BCE", min: -99999, max: -10001, works: [] },
            { label: "10,000 BCE to 5,000 BCE", min: -10000, max: -5001, works: [] },
            { label: "5,000 BCE to 3,000 BCE", min: -5000, max: -3001, works: [] },
            { label: "3,000 BCE to 1,500 BCE", min: -3000, max: -1501, works: [] },
            { label: "1,500 BCE to 1 CE", min: -1500, max: 0, works: [] },
            { label: "1 CE to 1000 CE", min: 1, max: 1000, works: [] },
            { label: "After 1000 CE", min: 1001, max: 99999, works: [] }
        ];
    } else {
        return [
            { label: "Before 1000 BCE", min: -99999, max: -1001, works: [] },
            { label: "1000 BCE to 500 BCE", min: -1000, max: -501, works: [] },
            { label: "500 BCE to 1 CE", min: -500, max: 0, works: [] },
            { label: "1 CE to 500 CE", min: 1, max: 500, works: [] },
            { label: "500 CE to 1000 CE", min: 501, max: 1000, works: [] },
            { label: "After 1000 CE", min: 1001, max: 99999, works: [] }
        ];
    }
}

// 2. Helper to get the active date object for a given work
function getActiveDate(w, currentViewMode, activeProposer = 'All') {
    const consensus = w.dates ? w.dates.find(d => d.type === 'scholarly_consensus') : null;
    let alternatives = w.dates ? w.dates.filter(d => d.type !== 'scholarly_consensus' && typeof d.start_year === 'number') : [];
    
    if (activeProposer && activeProposer !== 'All') {
        alternatives = alternatives.filter(d => d.proposer === activeProposer);
    }
    
    // Sort alternatives so the oldest (minimum start_year) comes first
    alternatives.sort((a, b) => a.start_year - b.start_year);
    
    if (currentViewMode === 'alternative') {
        if (alternatives.length > 0) return alternatives[0];
        if (w._imputedDateObj) return w._imputedDateObj;
    }
    return consensus;
}

// 3. Mathematical Engine for missing dates
function interpolateAlternativeDates(worksData, activeProposer = 'All') {
    // Initial sort by consensus date
    let sortedWorks = [...worksData].sort((a, b) => {
        const cA = a.dates ? a.dates.find(d => d.type === 'scholarly_consensus') : null;
        const cB = b.dates ? b.dates.find(d => d.type === 'scholarly_consensus') : null;
        const startA = cA ? cA.start_year : 99999;
        const startB = cB ? cB.start_year : 99999;
        return startA - startB;
    });

    const hasAlt = (work) => {
        let a = (work.dates || []).filter(d => d.type !== 'scholarly_consensus' && typeof d.start_year === 'number');
        if (activeProposer && activeProposer !== 'All') {
            a = a.filter(d => d.proposer === activeProposer);
        }
        return a.length > 0;
    };

    const getOldestAltYear = (work) => {
        let a = (work.dates || []).filter(d => d.type !== 'scholarly_consensus' && typeof d.start_year === 'number');
        if (activeProposer && activeProposer !== 'All') {
            a = a.filter(d => d.proposer === activeProposer);
        }
        a.sort((a, b) => a.start_year - b.start_year);
        return a.length > 0 ? a[0].start_year : null;
    };

    for (let i = 0; i < sortedWorks.length; i++) {
        const w = sortedWorks[i];
        
        if (!hasAlt(w)) {
            let prevIdx = -1;
            let nextIdx = -1;
            
            // Find nearest previous work with a valid numeric alternative date
            for (let j = i - 1; j >= 0; j--) {
                if (hasAlt(sortedWorks[j])) {
                    prevIdx = j; break;
                }
            }
            // Find nearest next work with a valid numeric alternative date
            for (let j = i + 1; j < sortedWorks.length; j++) {
                if (hasAlt(sortedWorks[j])) {
                    nextIdx = j; break;
                }
            }
            
            let myConsensus = w.dates.find(d => d.type === 'scholarly_consensus')?.start_year || 9999;
            let imputedStart = myConsensus;
            
            // Linear interpolation based on array index distance
            if (prevIdx !== -1 && nextIdx !== -1) {
                const pVal = getOldestAltYear(sortedWorks[prevIdx]);
                const nVal = getOldestAltYear(sortedWorks[nextIdx]);
                const totalSteps = nextIdx - prevIdx;
                const myStep = i - prevIdx;
                imputedStart = Math.round(pVal + ((nVal - pVal) / totalSteps) * myStep);
            } else if (prevIdx === -1 && nextIdx !== -1) {
                // Before the first anchor
                const nVal = getOldestAltYear(sortedWorks[nextIdx]);
                const nextConsensus = sortedWorks[nextIdx].dates.find(d => d.type === 'scholarly_consensus')?.start_year || 9999;
                const diff = nextConsensus - myConsensus;
                imputedStart = Math.min(myConsensus, nVal - diff);
            } else if (prevIdx !== -1 && nextIdx === -1) {
                // After the last anchor
                const pVal = getOldestAltYear(sortedWorks[prevIdx]);
                const prevConsensus = sortedWorks[prevIdx].dates.find(d => d.type === 'scholarly_consensus')?.start_year || 9999;
                const diff = myConsensus - prevConsensus;
                // Keep modern books in their consensus era if the alternative dates don't push them
                imputedStart = Math.max(myConsensus, pVal + diff);
            }

            if (imputedStart === myConsensus) {
                w._imputedDateObj = { 
                    ...w.dates.find(d => d.type === 'scholarly_consensus'), 
                    isShared: true 
                };
            } else {
                w._imputedDateObj = {
                    start_year: imputedStart,
                    end_year: imputedStart,
                    proposer: "Imputed",
                    isImputed: true
                };
            }
        } else {
            w._imputedDateObj = null;
        }
    }
    
    return sortedWorks;
}

// 4. Main Entrypoint: Process works and assign to buckets
function prepareTimelineData(worksData, currentViewMode, activeProposer = 'All') {
    const buckets = getBucketsForMode(currentViewMode);
    
    // Step A: Interpolate dates if we are in alternative view
    let processedWorks = [...worksData];
    if (currentViewMode === 'alternative') {
        processedWorks = interpolateAlternativeDates(processedWorks, activeProposer);
    }
    
    // Step B: Sort by the active date (which might be imputed)
    processedWorks.sort((a, b) => {
        const dA = getActiveDate(a, currentViewMode, activeProposer);
        const dB = getActiveDate(b, currentViewMode, activeProposer);
        const startA = dA ? dA.start_year : 99999;
        const startB = dB ? dB.start_year : 99999;
        return startA - startB;
    });

    // Step C: Assign to buckets
    processedWorks.forEach(w => {
        const activeD = getActiveDate(w, currentViewMode, activeProposer);
        const start = activeD ? activeD.start_year : 99999;
        
        const bucket = buckets.find(b => start >= b.min && start <= b.max);
        if (bucket) bucket.works.push(w);
    });

    return buckets;
}
