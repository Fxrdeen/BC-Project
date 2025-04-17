"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useBlockchain, UserProperty } from "@/lib/useBlockchain";
import UserPropertyCard from "@/components/Dashboard/PropertyCard";
import EmptyState from "@/components/Dashboard/EmptyState";
import PortfolioSummary from "@/components/Dashboard/PortfolioSummary";
import { Loader2, WalletIcon, Filter } from "lucide-react";

export default function DashboardPage() {
  const { getUserProperties, isConnected, connectWallet, account } =
    useBlockchain();
  const [userProperties, setUserProperties] = useState<UserProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate portfolio summary
  const totalProperties = userProperties.length;
  const totalTokens = userProperties.reduce(
    (sum, prop) => sum + prop.userTokens,
    0
  );
  const totalValue = userProperties.reduce(
    (sum, prop) => sum + prop.investmentValue,
    0
  );

  // Fetch user properties on mount

  useEffect(() => {
    const loadUserProperties = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const properties = await getUserProperties();
        console.log("User properties:", properties);
        setUserProperties(properties);
        setError(null);
      } catch (error) {
        console.error("Error loading user properties:", error);
        setError("Failed to load your investments");
      } finally {
        setLoading(false);
      }
    };

    loadUserProperties();
  }, [isConnected, getUserProperties]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const properties = await getUserProperties();
      setUserProperties(properties);
      setError(null);
    } catch (error) {
      console.error("Error refreshing properties:", error);
      setError("Failed to refresh your investments");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1029] via-[#111633] to-[#0f172a] text-white pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Investment Dashboard
          </h1>
          {isConnected ? (
            <p className="text-gray-400">
              Welcome back,{" "}
              <span className="text-blue-400">
                {account?.substring(0, 6)}...{account?.substring(38)}
              </span>
            </p>
          ) : (
            <p className="text-gray-400">
              Connect your wallet to view your investments
            </p>
          )}
        </motion.div>

        {/* Connect Wallet State */}
        {!isConnected && (
          <motion.div
            className="bg-[#111633]/50 border border-blue-500/20 rounded-xl p-8 text-center my-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WalletIcon className="h-16 w-16 mx-auto mb-4 text-blue-400 opacity-70" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-gray-400 max-w-lg mx-auto mb-6">
              Please connect your wallet to view your investment portfolio and
              track your property tokens.
            </p>
            <button
              onClick={connectWallet}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 mx-auto"
            >
              <WalletIcon size={18} />
              Connect Wallet
            </button>
          </motion.div>
        )}

        {/* Loading State */}
        {isConnected && loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin mb-4" />
            <p className="text-gray-300">
              Loading your investment portfolio...
            </p>
          </div>
        )}

        {/* Error State */}
        {isConnected && error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-8">
            <p>{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Portfolio Content */}
        {isConnected && !loading && !error && (
          <>
            {/* Portfolio Summary */}
            <PortfolioSummary
              totalProperties={totalProperties}
              totalTokens={totalTokens}
              totalValue={totalValue}
            />

            {/* Portfolio Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Properties</h2>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                <Filter size={16} />
                Refresh
              </button>
            </div>

            {/* Empty State */}
            {userProperties.length === 0 && <EmptyState />}

            {/* Property Grid */}
            {userProperties.length > 0 && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {userProperties.map((property, index) => (
                  <UserPropertyCard
                    key={property.propertyId}
                    property={property}
                    index={index}
                  />
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
