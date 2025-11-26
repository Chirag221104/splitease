import { Expense, Split, SplitType, Balance, Transaction, Settlement } from "@/types";

export const calculateSplits = (
    amount: number,
    splitType: SplitType,
    members: string[],
    splitsData: Partial<Split>[] = []
): Split[] => {
    let splits: Split[] = [];

    switch (splitType) {
        case 'EQUAL':
            const splitAmount = parseFloat((amount / members.length).toFixed(2));
            // Handle remainder
            const totalCalculated = splitAmount * members.length;
            const remainder = amount - totalCalculated;

            splits = members.map((memberId, index) => ({
                userId: memberId,
                amount: index === 0 ? parseFloat((splitAmount + remainder).toFixed(2)) : splitAmount
            }));
            break;

        case 'UNEQUAL':
            splits = splitsData.map(s => ({
                userId: s.userId!,
                amount: s.amount || 0
            }));
            break;

        case 'SHARES':
            const totalShares = splitsData.reduce((acc, curr) => acc + (curr.shares || 0), 0);
            if (totalShares === 0) return [];

            const shareValue = amount / totalShares;

            splits = splitsData.map(s => ({
                userId: s.userId!,
                amount: parseFloat(((s.shares || 0) * shareValue).toFixed(2)),
                shares: s.shares
            }));
            break;

        case 'PERCENTAGE':
            splits = splitsData.map(s => ({
                userId: s.userId!,
                amount: parseFloat(((amount * (s.percentage || 0)) / 100).toFixed(2)),
                percentage: s.percentage
            }));
            break;
    }

    return splits;
};

export const calculateGroupBalances = (
    expenses: Expense[],
    settlements: Settlement[],
    members: string[]
): Balance => {
    const balances: Balance = {};

    // Initialize balances
    members.forEach(m => balances[m] = 0);

    // Process expenses
    expenses.forEach(expense => {
        // Handle new multi-contributor format
        if (expense.contributors) {
            // Add contributions (what people paid)
            Object.entries(expense.contributors).forEach(([userId, amount]) => {
                balances[userId] = (balances[userId] || 0) + amount;
            });

            // Subtract splits (what people owe)
            expense.splits.forEach(split => {
                balances[split.userId] = (balances[split.userId] || 0) - split.amount;
            });
        }
        // Backward compatibility with old paidBy format
        else if (expense.paidBy) {
            const paidBy = expense.paidBy;
            expense.splits.forEach(split => {
                if (split.userId !== paidBy) {
                    balances[paidBy] = (balances[paidBy] || 0) + split.amount;
                    balances[split.userId] = (balances[split.userId] || 0) - split.amount;
                }
            });
        }
    });

    // Process settlements
    settlements.forEach(settlement => {
        // fromUser paid toUser
        // fromUser's balance increases (debt reduced)
        balances[settlement.fromUser] = (balances[settlement.fromUser] || 0) + settlement.amount;
        // toUser's balance decreases (owed amount reduced)
        balances[settlement.toUser] = (balances[settlement.toUser] || 0) - settlement.amount;
    });

    return balances;
};

export const simplifyDebts = (balances: Balance): Transaction[] => {
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([userId, amount]) => {
        if (amount < -0.01) debtors.push({ id: userId, amount: amount }); // Negative means they owe
        if (amount > 0.01) creditors.push({ id: userId, amount: amount }); // Positive means they are owed
    });

    // Sort by magnitude to optimize (optional, but good for greedy)
    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions: Transaction[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        // The amount to settle is the minimum of what debtor owes and creditor is owed
        const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

        // Round to 2 decimal places
        const roundedAmount = parseFloat(amount.toFixed(2));

        if (roundedAmount > 0) {
            transactions.push({
                from: debtor.id,
                to: creditor.id,
                amount: roundedAmount
            });
        }

        // Update remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled, move to next
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return transactions;
};

export const calculateGlobalBalances = (allGroupBalances: Record<string, number>[], currentUserId: string) => {
    const result = { owed: 0, owe: 0 };

    for (let i = 0; i < allGroupBalances.length; i++) {
        const groupBalances = allGroupBalances[i];

        for (const [uid, amount] of Object.entries(groupBalances)) {
            if (uid === currentUserId) {
                if (amount > 0) {
                    result.owed += amount;
                } else {
                    result.owe += Math.abs(amount);
                }
            }
        }
    }

    return result;
};
