export const resolveOverlaps = (blocks) => {
  if (!blocks || blocks.length === 0) return [];

  // 1. Convert times to absolute minutes from 00:00, using displayTimeSlot if present
  const processedBlocks = blocks.map(block => {
    const timeSlotToUse = block.displayTimeSlot || block.time_slot || '00:00';
    const [h, m] = timeSlotToUse.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + (block.duration_mins || 0);
    return {
      ...block,
      startMinutes,
      endMinutes,
    };
  });

  // Sort by startMinutes, then by duration descending (longer blocks first)
  processedBlocks.sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    return b.duration_mins - a.duration_mins;
  });

  // 2. Build collision groups
  const groups = [];
  let currentGroup = [];
  let currentGroupEnd = -1;

  for (const block of processedBlocks) {
    if (currentGroup.length === 0) {
      currentGroup.push(block);
      currentGroupEnd = block.endMinutes;
    } else if (block.startMinutes < currentGroupEnd) {
      // Overlap detected! Add to current group
      currentGroup.push(block);
      currentGroupEnd = Math.max(currentGroupEnd, block.endMinutes);
    } else {
      // No overlap. Save current group and start a new one
      groups.push(currentGroup);
      currentGroup = [block];
      currentGroupEnd = block.endMinutes;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // 3. For each group, assign sub-lanes (columns)
  const resolvedBlocks = [];
  
  for (const group of groups) {
    const columns = []; // array of columns, each containing blocks in that column

    for (const block of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        // Check if block overlaps with any block already in columns[c]
        const hasOverlap = columns[c].some(existing => 
          block.startMinutes < existing.endMinutes && block.endMinutes > existing.startMinutes
        );
        if (!hasOverlap) {
          columns[c].push(block);
          block.columnIndex = c;
          placed = true;
          break;
        }
      }

      if (!placed) {
        // Create a new column
        columns.push([block]);
        block.columnIndex = columns.length - 1;
      }
    }

    // Set width and left percentage for all blocks in this group
    const totalColumns = columns.length;
    for (const block of group) {
      block.totalColumns = totalColumns;
      block.widthPct = 100 / totalColumns;
      block.leftPct = block.columnIndex * block.widthPct;
      resolvedBlocks.push(block);
    }
  }

  return resolvedBlocks;
};
