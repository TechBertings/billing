import React from 'react';
import Status from './InvoicesByStatus';
import { FaExclamationTriangle } from 'react-icons/fa';

const OverdueInvoices = () => {
    return (
        <Status
            statusFilter="overdue"
            title="Overdue Invoices"
            icon={FaExclamationTriangle}
            color="from-red-500 to-rose-600"
        />
    );
};

export default OverdueInvoices;