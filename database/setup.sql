-- Create orders table in your existing aditdb database
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'shipped', 'delivered')) DEFAULT 'pending',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create notification function
CREATE OR REPLACE FUNCTION notify_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'order_updates',
        json_build_object(
            'operation', TG_OP,
            'table', 'orders',
            'data', row_to_json(COALESCE(NEW, OLD)),
            'timestamp', EXTRACT(epoch FROM NOW())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifications
DROP TRIGGER IF EXISTS order_changes_trigger ON orders;
CREATE TRIGGER order_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_order_changes();

-- Insert sample data
INSERT INTO orders (customer_name, product_name, status) VALUES
    ('John Doe', 'Laptop', 'pending'),
    ('Jane Smith', 'Phone', 'shipped'),
    ('Bob Johnson', 'Tablet', 'delivered');
