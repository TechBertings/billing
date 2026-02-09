import React from 'react';
import Status from './InvoicesByStatus';
import { FaCheckCircle } from 'react-icons/fa';

const PaidInvoices = () => {
    return (
        <Status
            statusFilter="paid"
            title="Paid Invoices"
            icon={FaCheckCircle}
            color="from-green-500 to-emerald-600"
        />
    );
};

export default PaidInvoices;