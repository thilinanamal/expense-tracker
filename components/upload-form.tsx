"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileUp, AlertCircle, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { processStatement } from "@/lib/actions"

export default function UploadForm() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
      setError(null)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one statement file to upload",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)
    setSuccess(null)

    try {
      let totalTransactions = 0

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append("file", file)

        // Update progress for each file
        setProgress(Math.round((i / files.length) * 100))

        // Process the statement
        const result = await processStatement(formData)

        if (result.success) {
          totalTransactions += result.transactionsCount || 0
          toast({
            title: "Statement processed",
            description: `Successfully processed ${file.name} with ${result.transactionsCount} transactions`,
          })
        } else {
          toast({
            title: "Processing failed",
            description: result.error || "Failed to process statement",
            variant: "destructive",
          })
          setError(`Failed to process ${file.name}: ${result.error || "Unknown error"}`)
        }
      }

      // Complete
      setProgress(100)

      if (!error) {
        setFiles([])
        setSuccess(`Successfully processed ${totalTransactions} transactions from ${files.length} files.`)
        toast({
          title: "All statements processed",
          description: `Successfully imported ${totalTransactions} transactions`,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setError(`Error processing statements: ${errorMessage}`)
      toast({
        title: "Upload failed",
        description: "There was an error processing your statements",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Drag & drop your statement files</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Supports CSV files from various banks and credit cards
              </p>
              <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                Select Files
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".csv,.pdf,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </CardContent>
        </Card>

        {files.length > 0 && (
          <div className="grid gap-4">
            <h3 className="text-lg font-medium">Selected Files</h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center">
                    <FileUp className="h-5 w-5 mr-2 text-muted-foreground" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} disabled={uploading}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">Processing statements... {progress}%</p>
          </div>
        )}

        <Button type="submit" disabled={files.length === 0 || uploading} className="w-full">
          {uploading ? "Processing..." : "Process Statements"}
        </Button>
      </div>
    </form>
  )
}
