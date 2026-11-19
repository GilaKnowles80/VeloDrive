import { useEffect, useState } from 'react';
import { apiClient } from '../utils/api';

export function useVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicleListings = async () => {
      try {
        const data = await apiClient('/vehicles');
        setVehicles(data);
      } catch (error) {
        console.error("Failed to load vehicles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicleListings();
  }, []);

  return { vehicles, loading };
}